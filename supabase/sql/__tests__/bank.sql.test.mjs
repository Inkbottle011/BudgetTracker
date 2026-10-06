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

    it('the server function can save transactions even if the project never granted it access', async () => {
        // Like a real project where service_role had no rights on the app's own transactions table
        await h.as('job')
        await h.db.exec('revoke all on public.transactions from service_role')
        await h.db.exec(sql('bank/01_setup.sql'))
        const { account } = await serverLinks(ALICE)   // now acting as service_role
        await h.insert('transactions', { user_id: ALICE, type: 'expense', amount: 5, date: '2026-10-01', provider: 'plaid', external_id: 'txn_1', bank_account_id: account })
        assert.deepEqual(await h.rows(`select external_id from transactions`), [{ external_id: 'txn_1' }])
    })

    it('transactions typed in by hand are unaffected', async () => {
        await asUser(ALICE)
        await h.insert('transactions', { user_id: ALICE, type: 'expense', amount: 5, date: '2026-10-01' })
        await h.insert('transactions', { user_id: ALICE, type: 'expense', amount: 5, date: '2026-10-01' })
        assert.deepEqual(await h.one(`select count(*)::int c from transactions`), { c: 2 })
    })
})

describe('possible duplicates to review', () => {
    /** You typed in $84.23 "Groceries"; the bank's copy says "WHOLE FOODS" a day later. */
    async function setup(userId = ALICE) {
        const { account } = await serverLinks(userId)
        const mine = await h.insert('transactions', { user_id: userId, type: 'expense', amount: 84.23, date: '2026-10-01', name: 'Groceries', category_label: 'Food' })
        await h.as('job')
        await h.db.exec('set role service_role')
        const review = await h.insert('bank_possible_duplicates', {
            user_id: userId, provider: 'plaid', external_id: 'txn_wf', bank_account_id: account,
            date: '2026-10-02', amount: 84.23, type: 'expense', name: 'WHOLE FOODS #10234', category_label: '',
            existing_transaction_id: mine,
        })
        return { mine, review, account }
    }
    const resolve = (id, choice) => h.db.query(`select resolve_possible_duplicate($1, $2)`, [id, choice])
    const transactions = () => h.rows(`select name, external_id from transactions order by name`)

    it('users see their own, side by side with the transaction they already have', async () => {
        await setup()
        await asUser(ALICE)
        assert.deepEqual(await h.rows(`
            select d.name as bank_name, d.amount::float, t.name as my_name
            from bank_possible_duplicates d left join transactions t on t.id = d.existing_transaction_id`),
        [{ bank_name: 'WHOLE FOODS #10234', amount: 84.23, my_name: 'Groceries' }])
    })

    it('are private, and need two-factor sign-in like other bank details', async () => {
        await setup()
        await asUser(BOB)
        assert.deepEqual(await h.rows(`select id from bank_possible_duplicates`), [])
        await asUser(ALICE, { twoFactor: false })
        assert.deepEqual(await h.rows(`select id from bank_possible_duplicates`), [])
        await h.as('anon')
        await assert.rejects(h.rows(`select id from bank_possible_duplicates`), /permission denied/)
    })

    it('the app can only resolve them, not add or change them', async () => {
        const { review } = await setup()
        await asUser(ALICE)
        await assert.rejects(h.db.query(`update bank_possible_duplicates set amount = 1 where id = $1`, [review]), /permission denied/)
        await assert.rejects(h.insert('bank_possible_duplicates', { user_id: ALICE, provider: 'plaid', external_id: 'x', date: '2026-10-01', amount: 1, type: 'expense' }), /permission denied/)
    })

    it('"Keep mine": yours stays and takes the bank\'s id, so the bank\'s copy is never added', async () => {
        const { review } = await setup()
        await asUser(ALICE)
        await resolve(review, 'keep_mine')
        assert.deepEqual(await transactions(), [{ name: 'Groceries', external_id: 'txn_wf' }])
        assert.deepEqual(await h.rows(`select id from bank_possible_duplicates`), [])
        await h.as('job')
        await assert.rejects(h.insert('transactions', { user_id: ALICE, type: 'expense', amount: 84.23, date: '2026-10-02', provider: 'plaid', external_id: 'txn_wf' }), /duplicate key/)
    })

    it('"Use bank\'s": the bank\'s copy replaces yours', async () => {
        const { review, account } = await setup()
        await asUser(ALICE)
        await resolve(review, 'use_bank')
        assert.deepEqual(await h.rows(`select name, amount::float, date::text, type, provider, external_id, bank_account_id from transactions`), [{
            name: 'WHOLE FOODS #10234', amount: 84.23, date: '2026-10-02', type: 'expense', provider: 'plaid', external_id: 'txn_wf', bank_account_id: account,
        }])
    })

    it('"Keep both": they really are two transactions', async () => {
        const { review } = await setup()
        await asUser(ALICE)
        await resolve(review, 'keep_both')
        assert.deepEqual(await transactions(), [{ name: 'Groceries', external_id: null }, { name: 'WHOLE FOODS #10234', external_id: 'txn_wf' }])
    })

    it('still works if you deleted yours in the meantime', async () => {
        const { review, mine } = await setup()
        await asUser(ALICE)
        await h.db.query(`delete from transactions where id = $1`, [mine])
        await resolve(review, 'use_bank')
        assert.deepEqual(await transactions(), [{ name: 'WHOLE FOODS #10234', external_id: 'txn_wf' }])
    })

    it('rejects unknown choices and other people\'s reviews', async () => {
        const { review } = await setup()
        await asUser(ALICE)
        await assert.rejects(resolve(review, 'delete_everything'), /Unknown choice/)
        await asUser(BOB)
        await assert.rejects(resolve(review, 'use_bank'), /not found/)
        await asUser(ALICE)
        assert.equal((await transactions()).length, 1)
    })

    it('the public anon key cannot resolve anything', async () => {
        const { review } = await setup()
        await h.as('anon')
        await assert.rejects(resolve(review, 'keep_both'), /permission denied/)
    })
})

describe('transfers between your own accounts', () => {
    async function dbWithTypeLimit() {
        const d = await freshDb({ typeCheck: true })
        await d.db.exec(`
            create function auth.jwt() returns jsonb language sql stable
              as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
        `)
        return d
    }

    it('allows the "transfer" type even if your table limits types, keeping reimbursements', async () => {
        const d = await dbWithTypeLimit()
        await d.db.exec(sql('reimbursements/01_setup.sql'))
        await d.db.exec(sql('bank/01_setup.sql'))
        for (const type of ['transfer', 'withdrawal', 'reimbursement', 'expense']) {
            await d.insert('transactions', { user_id: ALICE, type, amount: 1, date: '2026-10-01' })
        }
        await assert.rejects(d.insert('transactions', { user_id: ALICE, type: 'bogus', amount: 1, date: '2026-10-01' }), /check constraint/)
    })

    it('re-running the reimbursements setup afterwards still allows transfers', async () => {
        const d = await dbWithTypeLimit()
        await d.db.exec(sql('bank/01_setup.sql'))
        await d.db.exec(sql('reimbursements/01_setup.sql'))
        await d.insert('transactions', { user_id: ALICE, type: 'transfer', amount: 1, date: '2026-10-01' })
        await d.insert('transactions', { user_id: ALICE, type: 'withdrawal', amount: 1, date: '2026-10-01' })
    })

    it('linked banks start out needing the one-time transfer check', async () => {
        const { connection } = await serverLinks(ALICE)
        assert.deepEqual(await h.one(`select transfers_checked from bank_connections where id = $1`, [connection]), { transfers_checked: false })
    })
})
