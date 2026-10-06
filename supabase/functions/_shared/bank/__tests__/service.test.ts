/** @jest-environment node */
import { linkBank, syncConnection, unlinkBank, syncUser, startLink } from '../service.ts'
import { encryptToken, decryptToken } from '../crypto.ts'
import { ProviderError, type BankProvider } from '../types.ts'
import { fake, supabase as db } from '../../../../../test/fakeSupabase'

const KEY = Buffer.alloc(32, 3).toString('base64')

function fakeProvider(over: Partial<BankProvider> = {}): BankProvider & { calls: any[] } {
    const calls: any[] = []
    return {
        name: 'teller',
        calls,
        listAccounts: jest.fn(async (token: string) => {
            calls.push(['listAccounts', token])
            return [
                { providerAccountId: 'acc_checking', name: 'Checking', type: 'depository', subtype: 'checking', lastFour: '1234', institutionName: 'Chase' },
                { providerAccountId: 'acc_card', name: 'Sapphire', type: 'credit', subtype: 'credit_card', lastFour: '9876', institutionName: 'Chase' },
            ]
        }),
        listTransactions: jest.fn(async (token: string, accountId: string, since: string) => {
            calls.push(['listTransactions', token, accountId, since])
            return accountId === 'acc_checking'
                ? [
                    { externalId: 't1', providerAccountId: 'acc_checking', date: '2026-10-02', amount: -12.5, description: 'Corner Store', pending: false },
                    { externalId: 't2', providerAccountId: 'acc_checking', date: '2026-10-03', amount: -500, description: 'CHASE CREDIT CRD AUTOPAY', pending: false },
                ]
                : [{ externalId: 't3', providerAccountId: 'acc_card', date: '2026-10-02', amount: -45.99, description: 'Amazon', pending: false }]
        }),
        disconnect: jest.fn(async (token: string) => { calls.push(['disconnect', token]) }),
        getBalance: jest.fn(async (_token: string, accountId: string) =>
            accountId === 'acc_card' ? { current: 812.4, available: 4187.6 } : { current: 1500.25, available: 1400 }),
        ...over,
    } as any
}

const ops = (table: string, method: string) =>
    fake.calls(table).flatMap(c => c.ops.filter(o => o.method === method).map(o => ({ args: o.args, call: c })))

/** A fake database with one linked connection and its two accounts. */
async function databaseWithConnection(status = 'active', lastSynced: string | null = null) {
    const token = await encryptToken('token_good', KEY)
    fake.table('bank_connections', call => {
        if (call.ops.some(o => ['update', 'delete', 'upsert'].includes(o.method))) return { data: { id: 'conn-1' }, error: null }
        return {
            data: [{ id: 'conn-1', user_id: 'user-1', provider: 'teller', encrypted_token: token, status, sync_from: '2026-09-01', last_synced_at: lastSynced, transfers_checked: true }],
            error: null,
        }
    })
    fake.table('bank_accounts', call => {
        if (call.ops.some(o => o.method === 'upsert' || o.method === 'update')) return { data: [{ id: 'db-acc-1' }, { id: 'db-acc-2' }], error: null }
        return {
            data: [
                { id: 'db-acc-1', connection_id: 'conn-1', user_id: 'user-1', provider_account_id: 'acc_checking', type: 'depository' },
                { id: 'db-acc-2', connection_id: 'conn-1', user_id: 'user-1', provider_account_id: 'acc_card', type: 'credit' },
            ],
            error: null,
        }
    })
    fake.table('transactions', call => {
        const upsert = call.ops.find(o => o.method === 'upsert')
        if (upsert) return { data: upsert.args[0].map((_: any, i: number) => ({ id: `new-${i}` })), error: null }
        return { data: [], error: null }
    })
}

const deps = (provider = fakeProvider()) => ({ db: db as any, provider, key: KEY, today: () => '2026-10-06' })

beforeEach(() => fake.reset())

describe('linkBank', () => {
    it('checks the token works, stores it encrypted, saves the accounts and does a first sync', async () => {
        await databaseWithConnection()
        const provider = fakeProvider()
        const result = await linkBank(deps(provider), {
            userId: 'user-1', accessToken: 'token_good', enrollmentId: 'enr_1', institutionName: 'Chase', syncFrom: '2026-09-01',
        })
        const saved = ops('bank_connections', 'upsert')[0].args[0]
        expect(saved).toMatchObject({ user_id: 'user-1', provider: 'teller', provider_enrollment_id: 'enr_1', institution_name: 'Chase', sync_from: '2026-09-01', status: 'active' })
        expect(saved.encrypted_token).not.toContain('token_good')
        expect(await decryptToken(saved.encrypted_token, KEY)).toBe('token_good')
        expect(ops('bank_accounts', 'upsert')[0].args[0]).toEqual([
            expect.objectContaining({ connection_id: 'conn-1', user_id: 'user-1', provider_account_id: 'acc_checking', name: 'Checking', last_four: '1234' }),
            expect.objectContaining({ provider_account_id: 'acc_card', type: 'credit' }),
        ])
        expect(result).toMatchObject({ connectionId: 'conn-1', added: 3 })
    })

    it('exchanges the one-time token from the sign-in window when the provider uses one (Plaid)', async () => {
        await databaseWithConnection()
        const provider = fakeProvider({ exchangeLinkResult: jest.fn(async () => ({ accessToken: 'token_good', enrollmentId: 'item_1' })) } as any)
        await linkBank(deps(provider), { userId: 'user-1', publicToken: 'public-abc', institutionName: 'Chase', syncFrom: '2026-09-01' })
        expect(provider.exchangeLinkResult).toHaveBeenCalledWith({ publicToken: 'public-abc' })
        const saved = ops('bank_connections', 'upsert')[0].args[0]
        expect(saved.provider_enrollment_id).toBe('item_1')
        expect(await decryptToken(saved.encrypted_token, KEY)).toBe('token_good')
    })

    it('reports that transactions are still loading right after linking, without marking the bank broken', async () => {
        await databaseWithConnection()
        const provider = fakeProvider({ listTransactions: jest.fn(async () => { throw new ProviderError('not_ready', 'still loading') }) })
        const result = await linkBank(deps(provider), { userId: 'user-1', accessToken: 'token_good', enrollmentId: 'enr_1', institutionName: 'Chase', syncFrom: '2026-09-01' })
        expect(result).toMatchObject({ connectionId: 'conn-1', added: 0, status: 'pending' })
        const lastUpdate = ops('bank_connections', 'update').at(-1)!.args[0]
        expect(lastUpdate).toEqual({ status: 'active', last_error: null })
    })

    it('stores nothing if the bank rejects the token', async () => {
        await databaseWithConnection()
        const provider = fakeProvider({ listAccounts: jest.fn(async () => { throw new ProviderError('needs_relink', 'disconnected') }) })
        await expect(linkBank(deps(provider), { userId: 'user-1', accessToken: 'bad', enrollmentId: 'enr_1', institutionName: 'Chase', syncFrom: '2026-09-01' }))
            .rejects.toThrow(/disconnected/)
        expect(ops('bank_connections', 'upsert')).toHaveLength(0)
    })
})

describe('syncConnection', () => {
    it('adds new transactions; a card payment from checking stays spending when no matching payment is on a linked card', async () => {
        await databaseWithConnection()
        const result = await syncConnection(deps(), 'conn-1')
        const rows = ops('transactions', 'upsert')[0]
        expect(rows.args[0].map((r: any) => [r.external_id, r.type])).toEqual([['t1', 'expense'], ['t2', 'expense'], ['t3', 'expense']])
        expect(rows.args[1]).toEqual({ onConflict: 'user_id,provider,external_id', ignoreDuplicates: true })
        expect(result).toMatchObject({ added: 3 })
        expect(ops('bank_connections', 'update').at(-1)!.args[0]).toMatchObject({ status: 'active', last_error: null, last_synced_at: expect.any(String) })
    })

    it('holds back likely duplicates for you to review instead of adding them', async () => {
        await databaseWithConnection()
        // You typed in $12.50 "Snacks" on Oct 1; the bank says "Corner Store" on Oct 2
        fake.table('transactions', call => {
            const upsert = call.ops.find(o => o.method === 'upsert')
            if (upsert) return { data: upsert.args[0].map((_: any, i: number) => ({ id: `new-${i}` })), error: null }
            if (call.ops.some(o => o.method === 'is' && o.args[0] === 'external_id')) {
                return { data: [{ id: 'mine-1', date: '2026-10-01', amount: 12.5, name: 'Snacks', note: '', type: 'expense' }], error: null }
            }
            return { data: [], error: null }
        })
        fake.table('bank_possible_duplicates', call => {
            const upsert = call.ops.find(o => o.method === 'upsert')
            return { data: upsert ? upsert.args[0].map((_: any, i: number) => ({ id: `rev-${i}` })) : [], error: null }
        })
        const result = await syncConnection(deps(), 'conn-1')
        expect(ops('transactions', 'upsert')[0].args[0].map((r: any) => r.external_id)).toEqual(['t2', 't3'])
        const held = ops('bank_possible_duplicates', 'upsert')[0]
        expect(held.args[0]).toEqual([{
            user_id: 'user-1', provider: 'teller', external_id: 't1', bank_account_id: 'db-acc-1', date: '2026-10-02',
            amount: 12.5, type: 'expense', name: 'Corner Store', category_label: '', existing_transaction_id: 'mine-1',
        }])
        expect(held.args[1]).toEqual({ onConflict: 'user_id,provider,external_id', ignoreDuplicates: true })
        expect(result).toMatchObject({ added: 2, toReview: 1 })
    })

    it('looks for your matching transactions a few days either side of the sync window', async () => {
        await databaseWithConnection()
        await syncConnection(deps(), 'conn-1')
        const mine = fake.calls('transactions').find(c => c.ops.some(o => o.method === 'is' && o.args[0] === 'external_id'))!
        // a week either side: the same purchase at the same place can post days later
        expect(mine.ops.find(o => o.method === 'gte')!.args).toEqual(['date', '2026-08-25'])
    })

    it('never re-adds bank transactions already imported or waiting for review', async () => {
        await databaseWithConnection()
        fake.table('transactions', call => {
            const upsert = call.ops.find(o => o.method === 'upsert')
            if (upsert) return { data: upsert.args[0].map((_: any, i: number) => ({ id: `new-${i}` })), error: null }
            if (call.ops.some(o => o.method === 'not' && o.args[0] === 'external_id')) return { data: [{ external_id: 't1', provider: 'teller' }, { external_id: 't2', provider: 'teller' }], error: null }
            return { data: [], error: null }
        })
        fake.table('bank_possible_duplicates', { data: [{ external_id: 't3' }] })
        const result = await syncConnection(deps(), 'conn-1')
        expect(ops('transactions', 'upsert')).toHaveLength(0)
        expect(result).toMatchObject({ added: 0, toReview: 0 })
    })

    describe('transfers between your own accounts', () => {
        /** Savings -> checking at the same bank, plus whatever's already saved. */
        function bankWithTransfer(saved: any[] = [], transfersChecked = true) {
            return fakeProvider({
                listAccounts: jest.fn(async () => []),
                listTransactions: jest.fn(async (_t: string, accountId: string) => accountId === 'acc_checking'
                    ? [{ externalId: 'in1', providerAccountId: 'acc_checking', date: '2026-10-05', amount: 500, description: 'From Savings - 5213', pending: false }]
                    : [{ externalId: 'out1', providerAccountId: 'acc_card', date: '2026-10-05', amount: -42, description: 'Lunch', pending: false }]),
            })
        }
        async function database(saved: any[], transfersChecked: boolean, lastSynced: string | null = null) {
            await databaseWithConnection()
            fake.table('bank_connections', call => {
                if (call.ops.some(o => ['update', 'delete', 'upsert'].includes(o.method))) return { data: { id: 'conn-1' }, error: null }
                return { data: [{ id: 'conn-1', user_id: 'user-1', provider: 'teller', encrypted_token: (globalThis as any).__tok, status: 'active',
                    sync_from: '2026-09-01', last_synced_at: lastSynced, transfers_checked: transfersChecked }], error: null }
            })
            fake.table('transactions', call => {
                const upsert = call.ops.find(o => o.method === 'upsert')
                if (upsert) return { data: upsert.args[0].map((_: any, i: number) => ({ id: `new-${i}` })), error: null }
                if (call.ops.some(o => o.method === 'update')) return { data: null, error: null }
                if (call.ops.some(o => o.method === 'not' && o.args[0] === 'provider')) return { data: saved, error: null }
                return { data: [], error: null }
            })
        }
        beforeEach(async () => { (globalThis as any).__tok = await encryptToken('token_good', KEY) })

        it('saves a new transfer as "transfer" when its other side is already saved from another account', async () => {
            // The savings side came in earlier (e.g. from another bank's sync)
            await database([{ id: 'saved-out', bank_account_id: 'other-savings', date: '2026-10-04', amount: 500, type: 'expense', name: 'To Checking - 0026' }], true)
            fake.table('bank_accounts', call => call.ops.some(o => o.method === 'update') ? { data: null, error: null } : { data: [
                { id: 'db-acc-1', connection_id: 'conn-1', user_id: 'user-1', provider_account_id: 'acc_checking', type: 'depository' },
                { id: 'db-acc-2', connection_id: 'conn-1', user_id: 'user-1', provider_account_id: 'acc_card', type: 'credit' },
                { id: 'other-savings', connection_id: 'conn-2', user_id: 'user-1', provider_account_id: 'x', type: 'depository' },
            ], error: null })
            const result = await syncConnection(deps(bankWithTransfer()), 'conn-1')
            const rows = ops('transactions', 'upsert')[0].args[0]
            expect(rows.map((r: any) => [r.external_id, r.type])).toEqual([['in1', 'transfer'], ['out1', 'expense']])
            const update = ops('transactions', 'update')[0]
            expect(update.args[0]).toEqual({ type: 'transfer', category_label: '' })
            expect(update.call.ops.find(o => o.method === 'in')!.args).toEqual(['id', ['saved-out']])
            expect(result).toMatchObject({ transfers: 2 })
        })

        it('the one-time check re-reads the bank from your start date, to pair card payments imported before', async () => {
            await database([], false, '2026-10-05T08:00:00Z')
            const provider = bankWithTransfer()
            await syncConnection(deps(provider), 'conn-1')
            expect((provider.listTransactions as jest.Mock).mock.calls[0][2]).toBe('2026-09-01')
            // ...and only the usual last week after that
            fake.reset()
            await database([], true, '2026-10-05T08:00:00Z')
            const later = bankWithTransfer()
            await syncConnection(deps(later), 'conn-1')
            expect((later.listTransactions as jest.Mock).mock.calls[0][2]).toBe('2026-09-28')
        })

        it('fixes transfers already imported, once', async () => {
            const saved = [
                { id: 'a', bank_account_id: 'db-acc-1', date: '2026-09-10', amount: 300, type: 'expense', name: 'To Savings - 5213' },
                { id: 'b', bank_account_id: 'other-savings', date: '2026-09-10', amount: 300, type: 'income', name: 'From Checking - 0026' },
                { id: 'c', bank_account_id: 'db-acc-2', date: '2026-09-20', amount: 99, type: 'reimbursement', name: 'CAPITAL ONE MOBILE PYMT' },
            ]
            await database(saved, false)
            fake.table('bank_accounts', call => call.ops.some(o => o.method === 'update') ? { data: null, error: null } : { data: [
                { id: 'db-acc-1', connection_id: 'conn-1', user_id: 'user-1', provider_account_id: 'acc_checking', type: 'depository' },
                { id: 'db-acc-2', connection_id: 'conn-1', user_id: 'user-1', provider_account_id: 'acc_card', type: 'credit' },
                { id: 'other-savings', connection_id: 'conn-2', user_id: 'user-1', provider_account_id: 'x', type: 'depository' },
            ], error: null })
            await syncConnection(deps(bankWithTransfer()), 'conn-1')
            const updated = ops('transactions', 'update').flatMap(u => u.call.ops.find(o => o.method === 'in')!.args[1])
            expect(updated.sort()).toEqual(['a', 'b', 'c'])
            expect(ops('bank_connections', 'update').some(u => u.args[0].transfers_checked === true)).toBe(true)
        })

        it('keeps money you marked as Savings or Investment counted; only the other side becomes a transfer', async () => {
            await database([{ id: 'saved-out', bank_account_id: 'other-savings', date: '2026-10-05', amount: 500, type: 'savings', name: 'To Savings' }], true)
            fake.table('bank_accounts', call => call.ops.some(o => o.method === 'update') ? { data: null, error: null } : { data: [
                { id: 'db-acc-1', connection_id: 'conn-1', user_id: 'user-1', provider_account_id: 'acc_checking', type: 'depository' },
                { id: 'db-acc-2', connection_id: 'conn-1', user_id: 'user-1', provider_account_id: 'acc_card', type: 'credit' },
                { id: 'other-savings', connection_id: 'conn-2', user_id: 'user-1', provider_account_id: 'x', type: 'depository' },
            ], error: null })
            await syncConnection(deps(bankWithTransfer()), 'conn-1')
            expect(ops('transactions', 'upsert')[0].args[0].find((r: any) => r.external_id === 'in1').type).toBe('transfer')
            expect(ops('transactions', 'update')).toHaveLength(0)
        })

        it('pairs a payment from checking with the payment arriving on a linked card', async () => {
            await database([], true)
            const provider = fakeProvider({
                listTransactions: jest.fn(async (_t: string, accountId: string) => accountId === 'acc_checking'
                    ? [{ externalId: 'chk', providerAccountId: 'acc_checking', date: '2026-10-05', amount: -353.35, description: 'CAPITAL ONE', pending: false }]
                    : [{ externalId: 'card', providerAccountId: 'acc_card', date: '2026-10-05', amount: 353.35, description: 'CAPITAL ONE MOBILE PYMT', pending: false }]),
            })
            await syncConnection(deps(provider), 'conn-1')
            expect(ops('transactions', 'upsert')[0].args[0].map((r: any) => [r.external_id, r.type])).toEqual([['chk', 'transfer'], ['card', 'transfer']])
        })

        it('after that, leaves transactions you already have alone (so changing one back sticks)', async () => {
            const saved = [
                { id: 'a', bank_account_id: 'db-acc-1', date: '2026-09-10', amount: 300, type: 'expense', name: 'To Savings - 5213' },
                { id: 'b', bank_account_id: 'other-savings', date: '2026-09-10', amount: 300, type: 'income', name: 'From Checking - 0026' },
            ]
            await database(saved, true)
            await syncConnection(deps(bankWithTransfer()), 'conn-1')
            expect(ops('transactions', 'update')).toHaveLength(0)
        })
    })

    it('re-checks the last week on each sync to catch late-posting transactions', async () => {
        await databaseWithConnection('active', '2026-10-05T08:00:00Z')
        const provider = fakeProvider()
        await syncConnection(deps(provider), 'conn-1')
        expect(provider.calls.find(c => c[0] === 'listTransactions')![3]).toBe('2026-09-28')
    })

    it('never fetches before the chosen start date', async () => {
        await databaseWithConnection('active', null)
        const provider = fakeProvider()
        await syncConnection(deps(provider), 'conn-1')
        expect(provider.calls.find(c => c[0] === 'listTransactions')![3]).toBe('2026-09-01')
    })

    it('marks the connection as needing relinking when the bank revoked access', async () => {
        await databaseWithConnection()
        const provider = fakeProvider({ listTransactions: jest.fn(async () => { throw new ProviderError('needs_relink', 'The enrollment was disconnected') }) })
        const result = await syncConnection(deps(provider), 'conn-1')
        expect(result).toMatchObject({ added: 0, status: 'needs_relink' })
        expect(ops('bank_connections', 'update').at(-1)!.args[0]).toMatchObject({ status: 'needs_relink', last_error: 'The enrollment was disconnected' })
    })

    it('records temporary problems without giving up on the connection', async () => {
        await databaseWithConnection()
        const provider = fakeProvider({ listTransactions: jest.fn(async () => { throw new ProviderError('temporary', 'Bank is down') }) })
        expect(await syncConnection(deps(provider), 'conn-1')).toMatchObject({ status: 'error' })
    })

    it('never puts the bank token in an error message', async () => {
        await databaseWithConnection()
        const provider = fakeProvider({ listTransactions: jest.fn(async () => { throw new Error('failed with token_good in it') }) })
        await syncConnection(deps(provider), 'conn-1')
        expect(JSON.stringify(ops('bank_connections', 'update'))).not.toContain('token_good')
    })
})

describe('balances', () => {
    it('saves each account\'s balance on every sync', async () => {
        await databaseWithConnection()
        await syncConnection(deps(), 'conn-1')
        const updates = ops('bank_accounts', 'update')
        expect(updates.map(u => [u.args[0].balance_current, u.args[0].balance_available])).toEqual([[1500.25, 1400], [812.4, 4187.6]])
        expect(updates[1].args[0].balance_updated_at).toEqual(expect.any(String))
        expect(updates[1].call.ops).toContainEqual({ method: 'eq', args: ['id', 'db-acc-2'] })
    })

    it('keeps syncing transactions if a balance can\'t be fetched', async () => {
        await databaseWithConnection()
        const provider = fakeProvider({ getBalance: jest.fn(async () => { throw new ProviderError('other', 'Balance product not enabled') }) })
        const result = await syncConnection(deps(provider), 'conn-1')
        expect(result).toMatchObject({ added: 3, status: 'active' })
        expect(ops('bank_accounts', 'update')).toHaveLength(0)
    })

    it('works with providers that have no balances', async () => {
        await databaseWithConnection()
        const provider = fakeProvider()
        delete (provider as any).getBalance
        expect(await syncConnection(deps(provider), 'conn-1')).toMatchObject({ status: 'active' })
    })
})

describe('startLink', () => {
    it('asks the provider for a sign-in session for this user', async () => {
        const provider = fakeProvider({ createLinkSession: jest.fn(async (id: string) => ({ linkToken: `link-${id}` })) } as any)
        expect(await startLink(deps(provider), 'user-1')).toEqual({ linkToken: 'link-user-1' })
    })

    it('returns nothing for providers whose sign-in window needs no session (Teller)', async () => {
        expect(await startLink(deps(), 'user-1')).toEqual({})
    })
})

describe('syncUser', () => {
    it('syncs every connection of the user and totals the results', async () => {
        await databaseWithConnection()
        expect(await syncUser(deps(), 'user-1')).toMatchObject({ added: 3, toReview: 0, connections: 1 })
    })
})

describe('unlinkBank', () => {
    it('removes access at the provider, then deletes the connection (keeping transactions)', async () => {
        await databaseWithConnection()
        const provider = fakeProvider()
        await unlinkBank(deps(provider), { userId: 'user-1', connectionId: 'conn-1' })
        expect(provider.disconnect).toHaveBeenCalledWith('token_good')
        const del = ops('bank_connections', 'delete')[0]
        expect(del.call.ops).toContainEqual({ method: 'eq', args: ['id', 'conn-1'] })
        expect(del.call.ops).toContainEqual({ method: 'eq', args: ['user_id', 'user-1'] })
        expect(ops('transactions', 'delete')).toHaveLength(0)
    })

    it('only unlinks the signed-in user\'s own connections', async () => {
        await databaseWithConnection()
        await expect(unlinkBank(deps(), { userId: 'someone-else', connectionId: 'conn-1' })).rejects.toThrow(/not found/i)
    })

    it('still removes the connection if the provider already forgot it', async () => {
        await databaseWithConnection()
        const provider = fakeProvider({ disconnect: jest.fn(async () => { throw new ProviderError('needs_relink', 'gone') }) })
        await unlinkBank(deps(provider), { userId: 'user-1', connectionId: 'conn-1' })
        expect(ops('bank_connections', 'delete')).toHaveLength(1)
    })
})
