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
            data: [{ id: 'conn-1', user_id: 'user-1', provider: 'teller', encrypted_token: token, status, sync_from: '2026-09-01', last_synced_at: lastSynced }],
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
        expect(result).toMatchObject({ connectionId: 'conn-1', added: 2 })
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
    it('adds new transactions, skipping the card bill payment because the card is linked too', async () => {
        await databaseWithConnection()
        const result = await syncConnection(deps(), 'conn-1')
        const rows = ops('transactions', 'upsert')[0]
        expect(rows.args[0].map((r: any) => r.external_id)).toEqual(['t1', 't3'])
        expect(rows.args[1]).toEqual({ onConflict: 'user_id,provider,external_id', ignoreDuplicates: true })
        expect(result).toMatchObject({ added: 2 })
        expect(ops('bank_connections', 'update').at(-1)!.args[0]).toMatchObject({ status: 'active', last_error: null, last_synced_at: expect.any(String) })
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
        expect(result).toMatchObject({ added: 2, status: 'active' })
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
        expect(await syncUser(deps(), 'user-1')).toMatchObject({ added: 2, connections: 1 })
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
