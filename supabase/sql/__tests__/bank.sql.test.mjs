// Tests for supabase/sql/bank/01_setup.sql: bank connections whose tokens the app itself can never read.
import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { freshDb, sql, ALICE, BOB } from './helpers.mjs'

let h

/** Signed in as `who`, with or without having passed two-factor sign-in. */
async function asUser(who, { twoFactor = true } = {}) {
    await h.as(who)
    await h.db.exec(`select set_config('request.jwt.claims', '{"aal": "${twoFactor ? 'aal2' : 'aal1'}"}', false)`)
}

/** What the server function does when someone links a bank: it runs with the service role. */
async function serverLinks(userId, institution = 'Chase') {
    await h.as('job')
    await h.db.exec('set role service_role')
    const connection = await h.insert('bank_connections', {
        user_id: userId, provider: 'teller', provider_enrollment_id: `enr_${institution}_${userId.slice(-1)}`,
        institution_name: institution, encrypted_token: 'v1:secret-iv:secret-ciphertext', sync_from: '2026-09-01',
    })
    const account = await h.insert('bank_accounts', {
        connection_id: connection, user_id: userId, provider_account_id: `acc_${institution}`, name: 'Checking', type: 'depository', last_four: '1234',
    })
    return { connection, account }
}

beforeEach(async () => {
    h = await freshDb()
    // auth.jwt() as Supabase provides it, for the two-factor check
    await h.db.exec(`
        create function auth.jwt() returns jsonb language sql stable
          as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
        grant execute on function auth.jwt() to anon, authenticated;
    `)
    await h.db.exec(sql('bank/01_setup.sql'))
})

describe('bank connections', () => {
    it('can be set up more than once', async () => {
        await h.db.exec(sql('bank/01_setup.sql'))
    })

    it('users see their own linked banks, without the token', async () => {
        await serverLinks(ALICE)
        await asUser(ALICE)
        const rows = await h.rows(`select institution_name, status, provider from bank_connections`)
        assert.deepEqual(rows, [{ institution_name: 'Chase', status: 'active', provider: 'teller' }])
    })

    it('the app can never read the stored bank token', async () => {
        await serverLinks(ALICE)
        await asUser(ALICE)
        await assert.rejects(h.rows(`select encrypted_token from bank_connections`), /permission denied/)
        await assert.rejects(h.rows(`select * from bank_connections`), /permission denied/)
    })

    it('the app cannot create, change or delete connections directly; only the server can', async () => {
        const { connection } = await serverLinks(ALICE)
        await asUser(ALICE)
        await assert.rejects(h.insert('bank_connections', { provider: 'teller', provider_enrollment_id: 'x', encrypted_token: 'x', sync_from: '2026-01-01' }), /permission denied/)
        await assert.rejects(h.db.query(`update bank_connections set status = 'active' where id = $1`, [connection]), /permission denied/)
        await assert.rejects(h.db.query(`delete from bank_connections where id = $1`, [connection]), /permission denied/)
    })

    it('users cannot see other people\'s banks or accounts', async () => {
        await serverLinks(ALICE)
        await asUser(BOB)
        assert.deepEqual(await h.rows(`select id from bank_connections`), [])
        assert.deepEqual(await h.rows(`select id from bank_accounts`), [])
    })

    it('bank details are hidden until two-factor sign-in is passed', async () => {
        await serverLinks(ALICE)
        await asUser(ALICE, { twoFactor: false })
        assert.deepEqual(await h.rows(`select id from bank_connections`), [])
        assert.deepEqual(await h.rows(`select id from bank_accounts`), [])
    })

    it('the public anon key gets nothing', async () => {
        await serverLinks(ALICE)
        await h.as('anon')
        await assert.rejects(h.rows(`select id from bank_connections`), /permission denied/)
    })

    it('users see the accounts in their linked banks', async () => {
        await serverLinks(ALICE)
        await asUser(ALICE)
        assert.deepEqual(await h.rows(`select name, type, last_four from bank_accounts`), [{ name: 'Checking', type: 'depository', last_four: '1234' }])
    })

    it('users can read their account balances', async () => {
        const { account } = await serverLinks(ALICE)
        await h.db.query(`update bank_accounts set balance_current = 812.40, balance_available = 4187.60, balance_updated_at = now() where id = $1`, [account])
        await asUser(ALICE)
        assert.deepEqual(await h.rows(`select balance_current::float as owed, balance_available::float as available from bank_accounts`), [{ owed: 812.4, available: 4187.6 }])
    })

    it('removing a connection removes its accounts but keeps the transactions', async () => {
        const { connection, account } = await serverLinks(ALICE)
        await h.insert('transactions', { user_id: ALICE, type: 'expense', amount: 5, date: '2026-10-01', provider: 'teller', external_id: 'txn_1', bank_account_id: account })
        await h.db.query(`delete from bank_connections where id = $1`, [connection])
        assert.deepEqual(await h.one(`select count(*)::int c from bank_accounts`), { c: 0 })
        assert.deepEqual(await h.one(`select bank_account_id, external_id from transactions`), { bank_account_id: null, external_id: 'txn_1' })
    })
})

describe('transactions from banks', () => {
    it('the same bank transaction can only be saved once per user', async () => {
        await serverLinks(ALICE)
        const row = { user_id: ALICE, type: 'expense', amount: 5, date: '2026-10-01', provider: 'teller', external_id: 'txn_1' }
        await h.insert('transactions', row)
        await assert.rejects(h.insert('transactions', row), /duplicate key/)
        // A different user, or a different provider, is a different transaction
        await h.insert('transactions', { ...row, user_id: BOB })
        await h.insert('transactions', { ...row, provider: 'simplefin' })
    })

    it('transactions typed in by hand are unaffected', async () => {
        await asUser(ALICE)
        await h.insert('transactions', { user_id: ALICE, type: 'expense', amount: 5, date: '2026-10-01' })
        await h.insert('transactions', { user_id: ALICE, type: 'expense', amount: 5, date: '2026-10-01' })
        assert.deepEqual(await h.one(`select count(*)::int c from transactions`), { c: 2 })
    })
})
