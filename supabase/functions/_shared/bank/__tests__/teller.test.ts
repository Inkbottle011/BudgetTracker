/** @jest-environment node */
import { createTellerProvider } from '../teller.ts'
import { ProviderError } from '../types.ts'
import { providerContract, FAKE_BANK } from '../testing/providerContract'

/**
 * A fake Teller API built from the shared fake bank, following Teller's documented behavior:
 * Basic auth with the access token as username, pages of transactions newest-first with `count`
 * and `from_id`, `start_date` filtering, and DELETE /accounts to remove an enrollment.
 */
function fakeTeller({ pageSize = 10, failWith, cardLedgerSign = 1 }: { pageSize?: number; failWith?: number; cardLedgerSign?: number } = {}) {
    const calls: { method: string; url: string }[] = []
    const fetchImpl = async (input: string, init: any = {}) => {
        const url = new URL(input)
        const method = init.method ?? 'GET'
        calls.push({ method, url: input })
        const json = (status: number, body: any) => ({ ok: status < 300, status, json: async () => body, text: async () => JSON.stringify(body) })
        if (failWith) return json(failWith, { error: { code: 'server.error', message: 'oops' } })

        const token = Buffer.from(String(init.headers?.Authorization ?? '').replace('Basic ', ''), 'base64').toString().replace(/:$/, '')
        if (token === FAKE_BANK.revokedToken) {
            return method === 'DELETE'
                ? json(404, { error: { code: 'enrollment.not_found', message: 'gone' } })
                : json(401, { error: { code: 'enrollment.disconnected', message: 'The enrollment was disconnected' } })
        }
        if (token !== FAKE_BANK.goodToken) return json(401, { error: { code: 'unauthorized', message: 'bad token' } })

        if (method === 'DELETE' && url.pathname === '/accounts') return { ok: true, status: 204, json: async () => null, text: async () => '' }
        if (url.pathname === '/accounts') {
            return json(200, FAKE_BANK.accounts.map(a => ({
                id: a.id, name: a.name, type: a.type, subtype: a.subtype, last_four: a.lastFour,
                institution: { id: 'chase', name: a.institution }, enrollment_id: 'enr_1', status: 'open', currency: 'USD', links: {},
            })))
        }
        const bal = url.pathname.match(/^\/accounts\/([^/]+)\/balances$/)
        if (bal) {
            const a = FAKE_BANK.accounts.find(x => x.id === bal[1])!
            const ledger = a.type === 'credit' ? cardLedgerSign * a.balance : a.balance
            return json(200, { account_id: a.id, ledger: ledger.toFixed(2), available: a.available.toFixed(2), links: {} })
        }
        const m = url.pathname.match(/^\/accounts\/([^/]+)\/transactions$/)
        if (m) {
            const start = url.searchParams.get('start_date') ?? '0000'
            const fromId = url.searchParams.get('from_id')
            const count = Number(url.searchParams.get('count') ?? 1000)
            let list = FAKE_BANK.transactions
                .filter(t => t.accountId === m[1] && t.date >= start)
                .sort((a, b) => b.date.localeCompare(a.date))
            if (fromId) list = list.slice(list.findIndex(t => t.id === fromId) + 1)
            const page = list.slice(0, Math.min(count, pageSize))
            return json(200, page.map(t => ({
                id: t.id, account_id: t.accountId, date: t.date, amount: t.amount.toFixed(2), description: t.description,
                status: t.pending ? 'pending' : 'posted', type: 'card_payment', details: {}, links: {}, running_balance: null,
            })))
        }
        return json(404, { error: { code: 'not_found', message: 'no route' } })
    }
    return { fetchImpl, calls }
}

providerContract('Teller', () => createTellerProvider({ fetch: fakeTeller().fetchImpl }))

describe('Teller specifics', () => {
    it('sends the access token with Basic auth to api.teller.io', async () => {
        const seen: any[] = []
        const { fetchImpl } = fakeTeller()
        const provider = createTellerProvider({ fetch: async (url: string, init: any) => { seen.push({ url, init }); return fetchImpl(url, init) } })
        await provider.listAccounts(FAKE_BANK.goodToken)
        expect(seen[0].url).toBe('https://api.teller.io/accounts')
        expect(seen[0].init.headers.Authorization).toBe(`Basic ${Buffer.from(`${FAKE_BANK.goodToken}:`).toString('base64')}`)
    })

    it('treats server errors as temporary, so the connection is retried tomorrow rather than marked broken', async () => {
        const err = await createTellerProvider({ fetch: fakeTeller({ failWith: 503 }).fetchImpl }).listAccounts(FAKE_BANK.goodToken).catch(e => e)
        expect(err).toBeInstanceOf(ProviderError)
        expect(err.kind).toBe('temporary')
    })

    it('reports what\'s owed on a card as positive whichever sign Teller uses', async () => {
        const p = createTellerProvider({ fetch: fakeTeller({ cardLedgerSign: -1 }).fetchImpl })
        expect(await p.getBalance!(FAKE_BANK.goodToken, 'acc_card', 'credit')).toEqual({ current: 812.4, available: 4187.6 })
    })

    it('stops paging once it reaches the start date', async () => {
        const fake = fakeTeller({ pageSize: 5 })
        await createTellerProvider({ fetch: fake.fetchImpl }).listTransactions(FAKE_BANK.goodToken, 'acc_checking', '2026-09-25')
        expect(fake.calls.length).toBeLessThanOrEqual(3)
    })
})
