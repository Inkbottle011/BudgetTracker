// Tests for supabase/sql/merchants/01_setup.sql: your names for places.
import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { freshDb, sql, ALICE, BOB } from './helpers.mjs'

let h
beforeEach(async () => {
    h = await freshDb()
    await h.db.exec(sql('merchants/01_setup.sql'))
})

describe('renaming places', () => {
    it('can be set up more than once', async () => {
        await h.db.exec(sql('merchants/01_setup.sql'))
    })

    it('renaming keeps the bank\'s wording, and renaming again keeps the first wording', async () => {
        await h.as(ALICE)
        const a = await h.insert('transactions', { user_id: ALICE, type: 'expense', amount: 12.31, date: '2026-10-01', name: 'TACOS TEXAS' })
        const b = await h.insert('transactions', { user_id: ALICE, type: 'expense', amount: 14.55, date: '2026-10-02', name: 'TACOS TEXAS' })
        assert.deepEqual(await h.one(`select rename_transactions($1, 'Tacos Texas') as n`, [[a, b]]), { n: 2 })
        await h.db.query(`select rename_transactions($1, 'Taco spot')`, [[a]])
        assert.deepEqual(await h.rows(`select name, original_name from transactions order by amount`), [
            { name: 'Taco spot', original_name: 'TACOS TEXAS' },
            { name: 'Tacos Texas', original_name: 'TACOS TEXAS' },
        ])
    })

    it('only renames your own transactions', async () => {
        await h.as(BOB)
        const bobs = await h.insert('transactions', { user_id: BOB, type: 'expense', amount: 5, date: '2026-10-01', name: 'Wawa' })
        await h.as(ALICE)
        assert.deepEqual(await h.one(`select rename_transactions($1, 'Hacked') as n`, [[bobs]]), { n: 0 })
        await h.as(BOB)
        assert.deepEqual(await h.one(`select name from transactions`), { name: 'Wawa' })
    })

    it('your names are private', async () => {
        await h.as(ALICE)
        await h.insert('merchant_renames', { user_id: ALICE, merchant_key: 'tacos texas', display_name: 'Tacos Texas' })
        await h.as(BOB)
        assert.deepEqual(await h.rows(`select * from merchant_renames`), [])
        await assert.rejects(h.insert('merchant_renames', { user_id: ALICE, merchant_key: 'x', display_name: 'y' }), /row-level security/)
    })

    it('one name per place: saving again replaces it', async () => {
        await h.as(ALICE)
        await h.db.query(`insert into merchant_renames (user_id, merchant_key, display_name) values ($1, 'tacos texas', 'Tacos Texas')`, [ALICE])
        await h.db.query(`insert into merchant_renames (user_id, merchant_key, display_name) values ($1, 'tacos texas', 'Taco spot')
            on conflict (user_id, merchant_key) do update set display_name = excluded.display_name`, [ALICE])
        assert.deepEqual(await h.rows(`select display_name from merchant_renames`), [{ display_name: 'Taco spot' }])
    })

    it('the public anon key gets nothing', async () => {
        await h.as('anon')
        await assert.rejects(h.rows(`select * from merchant_renames`), /permission denied/)
        await assert.rejects(h.db.query(`select rename_transactions(array[]::uuid[], 'x')`), /permission denied/)
    })

    it('the bank function can read everyone\'s names', async () => {
        await h.as(ALICE)
        await h.insert('merchant_renames', { user_id: ALICE, merchant_key: 'tacos texas', display_name: 'Tacos Texas' })
        await h.as('job')
        await h.db.exec('set role service_role')
        assert.equal((await h.rows(`select * from merchant_renames`)).length, 1)
    })
})
