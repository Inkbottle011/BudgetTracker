/** @jest-environment node */
import { createSimplefinProvider } from '../simplefin.ts'
import { ProviderError, type BankProvider } from '../types.ts'
import { providerContract, FAKE_BANK } from '../testing/providerContract'

const HOST = 'beta-bridge.simplefin.org'
const accessUrl = (user: string) => `https://${user}:pw123@${HOST}/simplefin`
const epoch = (date: string) => Math.floor(Date.parse(`${date}T12:00:00Z`) / 1000)
const DAY = 86400

/**
 * A fake SimpleFIN server built from the shared fake bank, following the SimpleFIN protocol: Basic auth from
 * the access URL, GET /accounts with start-date/end-date (Unix times), pending=1 and balances-only=1,
 * amounts as text with money in positive, card balances negative, and a setup token that claims once.
 */
function fakeSimplefin({ maxDays = 60, failWith, oldShape = false }: { maxDays?: number; failWith?: number; oldShape?: boolean } = {}) {
    const calls: { method: string; url: string; auth?: string }[] = []
    let claimed = false
    const fetchImpl = async (input: string, init: any = {}) => {
        const url = new URL(input)
        const method = init.method ?? 'GET'
        const auth = init.headers?.Authorization
        calls.push({ method, url: input, auth })
        const reply = (status: number, body: any) => ({ ok: status < 300, status, json: async () => body, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) })
        if (url.username || url.password) throw new TypeError('Request cannot be constructed from a URL that includes credentials')
        if (failWith) return reply(failWith, 'Server trouble')

        if (method === 'POST' && url.pathname === '/simplefin/claim/abc123') {
            if (claimed) return reply(403, 'Already claimed')
            claimed = true
            return reply(200, accessUrl(FAKE_BANK.goodToken))
        }
        const user = Buffer.from(String(auth ?? '').replace('Basic ', ''), 'base64').toString().split(':')[0]
        if (user === FAKE_BANK.revokedToken) return reply(403, 'Access revoked')
        if (user === 'unpaid') return reply(402, 'Payment required')
        if (user !== FAKE_BANK.goodToken) return reply(403, 'Bad credentials')
        if (url.pathname !== '/simplefin/accounts') return reply(404, 'Not found')

        const start = Number(url.searchParams.get('start-date') ?? 0)
        const end = Number(url.searchParams.get('end-date') ?? epoch('2100-01-01'))
        if (url.searchParams.has('start-date') && (end - start) > maxDays * DAY) return reply(400, 'Date range too long')
        const withTx = url.searchParams.get('balances-only') !== '1'
        const pending = url.searchParams.get('pending') === '1'
        const accounts = FAKE_BANK.accounts.map(a => ({
            id: a.id, name: `${a.name} (${a.lastFour})`, currency: 'USD',
            ...(oldShape ? { org: { name: a.institution, domain: 'chase.com', 'sfin-url': 'https://chase.example' } } : { conn_id: 'conn_chase' }),
            balance: (a.type === 'credit' ? -a.balance : a.balance).toFixed(2),
            'available-balance': a.available.toFixed(2),
            'balance-date': epoch('2026-10-02'),
            ...(withTx ? {
                transactions: FAKE_BANK.transactions
                    .filter(t => t.accountId === a.id && (pending || !t.pending))
                    .filter(t => epoch(t.date) >= start && epoch(t.date) < end)
                    .map(t => ({
                        id: t.id, posted: t.pending ? 0 : epoch(t.date), transacted_at: epoch(t.date),
                        amount: t.amount.toFixed(2), description: t.description, ...(t.pending ? { pending: true } : {}),
                    })),
            } : {}),
        }))
        return reply(200, {
            errlist: [], ...(oldShape ? { errors: [] } : { connections: [{ conn_id: 'conn_chase', name: 'Chase', org_id: 'chase', sfin_url: 'https://chase.example' }] }),
            accounts,
        })
    }
    return { fetchImpl, calls }
}

/** The shared contract passes tokens like "token_good"; SimpleFIN's token is an access URL holding it. */
function withAccessUrls(p: BankProvider): BankProvider {
    return {
        ...p,
        listAccounts: t => p.listAccounts(accessUrl(t)),
        listTransactions: (t, id, since) => p.listTransactions(accessUrl(t), id, since),
        getBalance: (t, id, type) => p.getBalance!(accessUrl(t), id, type),
        disconnect: t => p.disconnect(accessUrl(t)),
    }
}

const NOW = () => '2026-10-03'
providerContract('SimpleFIN', () => withAccessUrls(createSimplefinProvider({ fetch: fakeSimplefin().fetchImpl, today: NOW })))

describe('SimpleFIN specifics', () => {
    const setupToken = Buffer.from(`https://${HOST}/simplefin/claim/abc123`).toString('base64')

    it('claims a setup token once for a lasting access link, and names the connection without keeping the password', async () => {
        const fake = fakeSimplefin()
        const p = createSimplefinProvider({ fetch: fake.fetchImpl, today: NOW })
        const { accessToken, enrollmentId } = await p.exchangeLinkResult!({ publicToken: `  ${setupToken}\n` })
        expect(accessToken).toBe(accessUrl(FAKE_BANK.goodToken))
        expect(enrollmentId).toMatch(/^[0-9a-f]{32}$/)
        expect(enrollmentId).not.toContain('pw123')
        expect(fake.calls[0]).toMatchObject({ method: 'POST', url: `https://${HOST}/simplefin/claim/abc123` })
        // The same token can't be used twice: SimpleFIN says to warn the person
        const again = await p.exchangeLinkResult!({ publicToken: setupToken }).catch(e => e)
        expect(again.message).toMatch(/already been used/)
    })

    it('only talks to SimpleFIN itself, whatever a pasted token says', async () => {
        const fake = fakeSimplefin()
        const p = createSimplefinProvider({ fetch: fake.fetchImpl, today: NOW })
        for (const bad of ['http://beta-bridge.simplefin.org/simplefin/claim/abc123', 'https://evil.example/simplefin/claim/abc123', 'https://beta-bridge.simplefin.org.evil.example/claim/x']) {
            const err = await p.exchangeLinkResult!({ publicToken: Buffer.from(bad).toString('base64') }).catch(e => e)
            expect(err.message).toMatch(/isn't a SimpleFIN setup token/)
        }
        expect((await p.exchangeLinkResult!({ publicToken: 'not base64 at all!!' }).catch(e => e)).message).toMatch(/isn't a SimpleFIN setup token/)
        expect(fake.calls).toEqual([])
        await expect(p.listAccounts('https://u:p@evil.example/simplefin')).rejects.toThrow(/isn't a SimpleFIN access link/)
    })

    it('sends the access link\'s user and password as Basic auth, never in the address', async () => {
        const fake = fakeSimplefin()
        await createSimplefinProvider({ fetch: fake.fetchImpl, today: NOW }).listAccounts(accessUrl(FAKE_BANK.goodToken))
        expect(fake.calls[0].url).toBe(`https://${HOST}/simplefin/accounts?balances-only=1`)
        expect(fake.calls[0].auth).toBe(`Basic ${Buffer.from(`${FAKE_BANK.goodToken}:pw123`).toString('base64')}`)
    })

    it('asks for history a couple of months at a time, once per sync for all accounts', async () => {
        const fake = fakeSimplefin({ maxDays: 60 })
        const p = createSimplefinProvider({ fetch: fake.fetchImpl, today: NOW })
        const token = accessUrl(FAKE_BANK.goodToken)
        await p.listTransactions(token, 'acc_checking', '2026-01-01')
        await p.listTransactions(token, 'acc_card', '2026-01-01')
        expect(fake.calls.length).toBe(5)   // Jan 1 to Oct 3 in 60-day pieces, shared by both accounts
    })

    it('works with the older response shape (the bank\'s name on each account)', async () => {
        const p = createSimplefinProvider({ fetch: fakeSimplefin({ oldShape: true }).fetchImpl, today: NOW })
        const accounts = await p.listAccounts(accessUrl(FAKE_BANK.goodToken))
        expect(accounts[0]).toMatchObject({ institutionName: 'Chase', name: 'Everyday Checking', lastFour: '1234' })
    })

    it('a lapsed SimpleFIN subscription needs relinking, with a clear message; server trouble is temporary', async () => {
        const p = createSimplefinProvider({ fetch: fakeSimplefin().fetchImpl, today: NOW })
        const unpaid = await p.listAccounts(accessUrl('unpaid')).catch(e => e)
        expect(unpaid).toBeInstanceOf(ProviderError)
        expect([unpaid.kind, unpaid.message]).toEqual(['needs_relink', 'Your SimpleFIN subscription needs renewing at bridge.simplefin.org.'])
        const down = await createSimplefinProvider({ fetch: fakeSimplefin({ failWith: 500 }).fetchImpl, today: NOW }).listAccounts(accessUrl(FAKE_BANK.goodToken)).catch(e => e)
        expect(down.kind).toBe('temporary')
    })

    it('guesses which accounts are cards, since SimpleFIN doesn\'t say', async () => {
        const p = createSimplefinProvider({ fetch: fakeSimplefin().fetchImpl, today: NOW })
        const [checking, card] = await p.listAccounts(accessUrl(FAKE_BANK.goodToken))
        expect([checking.type, checking.subtype, card.type, card.subtype]).toEqual(['depository', 'checking', 'credit', 'credit_card'])
    })
})
