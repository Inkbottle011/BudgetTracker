/** @jest-environment node */
import { createPlaidProvider } from '../plaid.ts'
import { ProviderError } from '../types.ts'
import { providerContract, FAKE_BANK } from '../testing/providerContract'

const TODAY = '2026-10-06'

/**
 * A fake Plaid API built from the shared fake bank, following Plaid's documented behavior:
 * POST JSON with client_id + secret, amounts positive for money OUT, /transactions/get paged
 * with count/offset and total_transactions, errors as { error_type, error_code, error_message }.
 */
function fakePlaid({ pageSize = 10, notReady = false, failStatus }: { pageSize?: number; notReady?: boolean; failStatus?: number } = {}) {
    const calls: { url: string; body: any }[] = []
    const fetchImpl = async (url: string, init: any) => {
        const body = JSON.parse(init.body)
        calls.push({ url, body })
        const json = (status: number, b: any) => ({ ok: status < 300, status, json: async () => b, text: async () => JSON.stringify(b) })
        const error = (status: number, code: string, type = 'ITEM_ERROR') => json(status, { error_type: type, error_code: code, error_message: `${code} happened`, display_message: null })

        if (failStatus) return error(failStatus, 'INTERNAL_SERVER_ERROR', 'API_ERROR')
        if (body.client_id !== 'client-1' || body.secret !== 'secret-1') return error(400, 'INVALID_API_KEYS', 'INVALID_INPUT')
        const path = new URL(url).pathname

        if (path === '/link/token/create') return json(200, { link_token: `link-sandbox-${body.user.client_user_id}`, expiration: '2026-10-06T16:00:00Z' })
        if (path === '/item/public_token/exchange') {
            return body.public_token === 'public-good'
                ? json(200, { access_token: FAKE_BANK.goodToken, item_id: 'item_1' })
                : error(400, 'INVALID_PUBLIC_TOKEN', 'INVALID_INPUT')
        }

        if (body.access_token === FAKE_BANK.revokedToken) {
            return path === '/item/remove' ? error(400, 'ITEM_NOT_FOUND') : error(400, 'ITEM_LOGIN_REQUIRED')
        }
        if (body.access_token !== FAKE_BANK.goodToken) return error(400, 'INVALID_ACCESS_TOKEN', 'INVALID_INPUT')

        if (path === '/item/remove') return json(200, { request_id: 'r' })
        if (path === '/accounts/get') {
            const ids = body.options?.account_ids
            return json(200, {
                accounts: FAKE_BANK.accounts.filter(a => !ids || ids.includes(a.id)).map(a => ({
                    account_id: a.id, name: a.name, official_name: null, type: a.type, subtype: a.subtype, mask: a.lastFour,
                    // Plaid: for cards, current = amount owed (positive), available = credit left
                    balances: { current: a.balance, available: a.available, limit: null, iso_currency_code: 'USD' },
                })),
                item: { item_id: 'item_1', institution_id: 'ins_3' },
            })
        }
        if (path === '/transactions/get') {
            if (notReady) return error(400, 'PRODUCT_NOT_READY')
            const all = FAKE_BANK.transactions
                .filter(t => body.options.account_ids.includes(t.accountId) && t.date >= body.start_date && t.date <= body.end_date)
                .sort((a, b) => b.date.localeCompare(a.date))
            const offset = body.options.offset ?? 0
            const page = all.slice(offset, offset + Math.min(body.options.count ?? 100, pageSize))
            return json(200, {
                transactions: page.map(t => ({
                    transaction_id: t.id, account_id: t.accountId, date: t.date, name: t.description,
                    merchant_name: null, amount: -t.amount, pending: t.pending, iso_currency_code: 'USD',
                })),
                total_transactions: all.length,
                accounts: [],
            })
        }
        return error(404, 'NOT_FOUND', 'INVALID_REQUEST')
    }
    return { fetchImpl, calls }
}

const make = (opts?: Parameters<typeof fakePlaid>[0]) => {
    const fake = fakePlaid(opts)
    const provider = createPlaidProvider({ fetch: fake.fetchImpl, clientId: 'client-1', secret: 'secret-1', env: 'sandbox', today: () => TODAY })
    return { provider, calls: fake.calls }
}

providerContract('Plaid', () => make().provider)

describe('Plaid specifics', () => {
    it('sends requests to the right environment with the API keys in the body', async () => {
        const { provider, calls } = make()
        await provider.listAccounts(FAKE_BANK.goodToken)
        expect(calls[0].url).toBe('https://sandbox.plaid.com/accounts/get')
        expect(calls[0].body).toMatchObject({ client_id: 'client-1', secret: 'secret-1', access_token: FAKE_BANK.goodToken })

        const fake = fakePlaid()
        const prod = createPlaidProvider({ fetch: fake.fetchImpl, clientId: 'client-1', secret: 'secret-1', env: 'production' })
        await prod.listAccounts(FAKE_BANK.goodToken)
        expect(fake.calls[0].url).toBe('https://production.plaid.com/accounts/get')
    })

    it('starts a Link session for the signed-in user, asking only for transactions', async () => {
        const { provider, calls } = make()
        expect(await provider.createLinkSession!('user-1')).toEqual({ linkToken: 'link-sandbox-user-1' })
        expect(calls[0].body).toMatchObject({
            client_name: 'Budget Tracker', user: { client_user_id: 'user-1' }, products: ['transactions'], country_codes: ['US'], language: 'en',
        })
    })

    it('exchanges the one-time token from Link for a lasting access token', async () => {
        const { provider } = make()
        expect(await provider.exchangeLinkResult!({ publicToken: 'public-good' })).toEqual({ accessToken: FAKE_BANK.goodToken, enrollmentId: 'item_1' })
        await expect(provider.exchangeLinkResult!({ publicToken: 'public-bad' })).rejects.toThrow(ProviderError)
    })

    it('asks for transactions up to today, per account', async () => {
        const { provider, calls } = make()
        await provider.listTransactions(FAKE_BANK.goodToken, 'acc_checking', '2026-09-28')
        expect(calls[0].body).toMatchObject({ start_date: '2026-09-28', end_date: TODAY, options: { account_ids: ['acc_checking'], offset: 0 } })
    })

    it('says when transactions are still loading right after linking', async () => {
        const err = await make({ notReady: true }).provider.listTransactions(FAKE_BANK.goodToken, 'acc_checking', '2026-09-01').catch(e => e)
        expect(err).toBeInstanceOf(ProviderError)
        expect(err.kind).toBe('not_ready')
    })

    it('treats Plaid server errors as temporary', async () => {
        const err = await make({ failStatus: 500 }).provider.listAccounts(FAKE_BANK.goodToken).catch(e => e)
        expect(err.kind).toBe('temporary')
    })

    it('never puts the API secret in error messages', async () => {
        const fake = fakePlaid()
        const p = createPlaidProvider({ fetch: fake.fetchImpl, clientId: 'client-1', secret: 'wrong-secret', env: 'sandbox' })
        const err = await p.listAccounts(FAKE_BANK.goodToken).catch(e => e)
        expect(String(err.message)).not.toContain('wrong-secret')
    })
})
