// Tests for supabase/sql/core/00_tables.sql: the app's main tables, for a brand-new Supabase project.
// On an existing project (like the live one) it must change nothing.
import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { freshDb, sql, ALICE, BOB } from './helpers.mjs'

let h
beforeEach(async () => { h = await freshDb() })
const policies = (table) => h.rows(`select policyname from pg_policies where tablename = $1 order by policyname`, [table]).then(r => r.map(p => p.policyname))

describe('core tables', () => {
    it('creates the tables a new project needs, and can be run again', async () => {
        await h.db.exec(`drop table public.transactions`)
        await h.db.exec(sql('core/00_tables.sql'))
        await h.db.exec(sql('core/00_tables.sql'))
        for (const t of ['transactions', 'budget_items', 'budget_amounts']) {
            assert.ok((await h.one(`select to_regclass('public.${t}') as t`)).t, t)
            assert.equal((await h.one(`select relrowsecurity as on from pg_class where relname = $1`, [t])).on, true, `${t} has row-level security`)
        }
    })

    it('each person only sees and changes their own rows', async () => {
        await h.db.exec(`drop table public.transactions`)
        await h.db.exec(sql('core/00_tables.sql'))
        await h.as(ALICE)
        const item = await h.insert('budget_items', { user_id: ALICE, name: 'Rent', type: 'expense' })
        await h.insert('budget_amounts', { user_id: ALICE, budget_item_id: item, month: 1, year: 2026, amount: 900 })
        await h.insert('transactions', { user_id: ALICE, type: 'expense', amount: 5, date: '2026-10-01', name: 'Coffee' })
        await h.as(BOB)
        for (const t of ['transactions', 'budget_items', 'budget_amounts']) {
            assert.deepEqual(await h.rows(`select * from ${t}`), [], `Bob can't see Alice's ${t}`)
        }
        await assert.rejects(h.insert('budget_items', { user_id: ALICE, name: 'Sneaky', type: 'expense' }))
    })

    it('one amount per item per month (the app saves with "upsert"), and deleting an item removes its amounts', async () => {
        await h.db.exec(sql('core/00_tables.sql'))
        await h.as(ALICE)
        const item = await h.insert('budget_items', { user_id: ALICE, name: 'Rent', type: 'expense' })
        const save = (amount) => h.db.query(
            `insert into budget_amounts (user_id, budget_item_id, month, year, amount) values ($1, $2, 3, 2026, $3)
             on conflict (budget_item_id, month, year) do update set amount = excluded.amount`, [ALICE, item, amount])
        await save(900)
        await save(950)
        assert.deepEqual(await h.rows(`select amount::float as amount from budget_amounts`), [{ amount: 950 }])
        await h.db.query(`delete from budget_items where id = $1`, [item])
        assert.deepEqual(await h.rows(`select * from budget_amounts`), [])
    })

    it('leaves an existing table and its own rules alone', async () => {
        assert.deepEqual(await policies('transactions'), ['own'])
        await h.db.exec(sql('core/00_tables.sql'))
        assert.deepEqual(await policies('transactions'), ['own'])
    })
})
