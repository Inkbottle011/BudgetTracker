// Tests for supabase/sql/reimbursements/01_setup.sql, run on an in-memory Postgres like a Supabase project.
import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { freshDb, sql, ALICE, BOB } from './helpers.mjs'

const SETUP = sql('reimbursements/01_setup.sql')

let h
async function setup(options) {
    h = await freshDb(options)
    await h.db.exec(SETUP)
}

/** Alice's $120 dinner, as Alice. */
async function dinner() {
    await h.as(ALICE)
    return h.insert('transactions', { user_id: ALICE, type: 'expense', amount: 120, name: 'Dinner', category_label: 'Food', date: '2026-10-01' })
}

describe('reimbursement type', () => {
    it('allows reimbursement transactions when the table limits types', async () => {
        await setup({ typeCheck: true })
        const id = await dinner()
        await h.insert('transactions', { user_id: ALICE, type: 'reimbursement', amount: 30, name: 'Venmo from Sam', category_label: 'Food', date: '2026-10-02', reimburses_id: id })
        assert.deepEqual(await h.one(`select count(*)::int c from transactions where type = 'reimbursement'`), { c: 1 })
    })

    it('still rejects unknown types when the table limits types', async () => {
        await setup({ typeCheck: true })
        await h.as(ALICE)
        await assert.rejects(h.insert('transactions', { user_id: ALICE, type: 'gift', amount: 1, date: '2026-10-01' }), /check/)
    })

    it('works when the table has no type limit', async () => {
        await setup()
        await dinner()
        await h.insert('transactions', { user_id: ALICE, type: 'reimbursement', amount: 30, date: '2026-10-02' })
    })

    it('can be run more than once', async () => {
        await setup({ typeCheck: true })
        await h.db.exec(SETUP)
        await h.db.exec(SETUP)
        const checks = await h.rows(`select conname from pg_constraint where conrelid = 'public.transactions'::regclass and contype = 'c'`)
        assert.equal(checks.length, 1)
    })

    it('unlinks a reimbursement when its expense is deleted, but keeps it', async () => {
        await setup()
        const id = await dinner()
        const r = await h.insert('transactions', { user_id: ALICE, type: 'reimbursement', amount: 30, date: '2026-10-02', reimburses_id: id })
        await h.db.query(`delete from transactions where id = $1`, [id])
        assert.deepEqual(await h.one(`select reimburses_id from transactions where id = $1`, [r]), { reimburses_id: null })
    })
})

describe('split shares', () => {
    beforeEach(() => setup())

    it('signed-in users can record who owes them for their own expense', async () => {
        const id = await dinner()
        await h.insert('split_shares', { expense_id: id, person: 'Sam', amount: 30 })
        await h.insert('split_shares', { expense_id: id, person: 'Alex', amount: 30 })
        const shares = await h.rows(`select person, amount::float, user_id, settled_by from split_shares order by person`)
        assert.deepEqual(shares, [
            { person: 'Alex', amount: 30, user_id: ALICE, settled_by: null },
            { person: 'Sam', amount: 30, user_id: ALICE, settled_by: null },
        ])
    })

    it('marks a share paid by linking the reimbursement, and reopens it if that is deleted', async () => {
        const id = await dinner()
        const share = await h.insert('split_shares', { expense_id: id, person: 'Sam', amount: 30 })
        const r = await h.insert('transactions', { user_id: ALICE, type: 'reimbursement', amount: 30, date: '2026-10-02', reimburses_id: id })
        await h.db.query(`update split_shares set settled_by = $1 where id = $2`, [r, share])
        assert.deepEqual(await h.one(`select settled_by from split_shares`), { settled_by: r })
        await h.db.query(`delete from transactions where id = $1`, [r])
        assert.deepEqual(await h.one(`select settled_by from split_shares`), { settled_by: null })
    })

    it('deleting the expense deletes its shares', async () => {
        const id = await dinner()
        await h.insert('split_shares', { expense_id: id, person: 'Sam', amount: 30 })
        await h.db.query(`delete from transactions where id = $1`, [id])
        assert.deepEqual(await h.one(`select count(*)::int c from split_shares`), { c: 0 })
    })

    it('rejects a blank name or an amount of 0', async () => {
        const id = await dinner()
        await assert.rejects(h.insert('split_shares', { expense_id: id, person: '  ', amount: 30 }), /check/)
        await assert.rejects(h.insert('split_shares', { expense_id: id, person: 'Sam', amount: 0 }), /check/)
    })

    describe('security', () => {
        it('users only see their own shares', async () => {
            const id = await dinner()
            await h.insert('split_shares', { expense_id: id, person: 'Sam', amount: 30 })
            await h.as(BOB)
            assert.deepEqual(await h.rows(`select * from split_shares`), [])
        })

        it('users cannot attach shares to someone else\'s expense', async () => {
            const id = await dinner()
            await h.as(BOB)
            await assert.rejects(h.insert('split_shares', { expense_id: id, person: 'Sam', amount: 30 }), /row-level security/)
        })

        it('users cannot settle a share with someone else\'s transaction', async () => {
            await h.as(BOB)
            const bobs = await h.insert('transactions', { user_id: BOB, type: 'income', amount: 30, date: '2026-10-02' })
            const id = await dinner()
            const share = await h.insert('split_shares', { expense_id: id, person: 'Sam', amount: 30 })
            await assert.rejects(h.db.query(`update split_shares set settled_by = $1 where id = $2`, [bobs, share]), /row-level security/)
        })

        it('the public anon key cannot read shares', async () => {
            await h.as('anon')
            await assert.rejects(h.rows(`select * from split_shares`), /permission denied/)
        })
    })
})
