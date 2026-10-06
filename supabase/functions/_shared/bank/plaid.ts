// Plaid plug-in: the only file that knows about Plaid's API.
// Docs: https://plaid.com/docs/api/ — every call is a POST with client_id and secret in the JSON body.
// Amounts from Plaid are positive for money OUT, so they're flipped to the app's convention here.
import { BankAccount, BankBalance, BankProvider, BankTransaction, ProviderError } from './types.ts'

type FetchLike = (url: string, init?: any) => Promise<{ ok: boolean; status: number; json(): Promise<any>; text(): Promise<string> }>

const PAGE_SIZE = 500
const MAX_PAGES = 100

const NEEDS_RELINK = new Set([
    'ITEM_LOGIN_REQUIRED', 'INVALID_ACCESS_TOKEN', 'ITEM_NOT_FOUND', 'ACCESS_NOT_GRANTED',
    'USER_PERMISSION_REVOKED', 'NO_ACCOUNTS', 'ITEM_LOCKED', 'INVALID_PUBLIC_TOKEN',
])
const TEMPORARY = new Set([
    'INTERNAL_SERVER_ERROR', 'RATE_LIMIT_EXCEEDED', 'INSTITUTION_DOWN', 'INSTITUTION_NOT_RESPONDING',
    'INSTITUTION_NOT_AVAILABLE', 'PLANNED_MAINTENANCE', 'PRODUCTS_NOT_READY',
])

export function createPlaidProvider({ fetch, clientId, secret, env, today = () => new Date().toISOString().slice(0, 10) }: {
    fetch: FetchLike
    clientId: string
    secret: string
    env: 'sandbox' | 'production'
    today?: () => string
}): BankProvider {
    const baseUrl = env === 'production' ? 'https://production.plaid.com' : 'https://sandbox.plaid.com'

    async function call(path: string, body: Record<string, unknown>) {
        let res
        try {
            res = await fetch(`${baseUrl}${path}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ client_id: clientId, secret, ...body }),
            })
        } catch (e: any) {
            throw new ProviderError('temporary', `Couldn't reach Plaid: ${e?.message ?? 'network error'}`)
        }
        let data: any = null
        try { data = await res.json() } catch { /* not JSON */ }
        if (res.ok) return data

        const code = String(data?.error_code ?? '')
        const message = String(data?.display_message ?? data?.error_message ?? `Plaid returned ${res.status}`)
        if (code === 'PRODUCT_NOT_READY') throw new ProviderError('not_ready', "Your bank's transactions are still loading")
        if (NEEDS_RELINK.has(code)) throw new ProviderError('needs_relink', message)
        if (TEMPORARY.has(code) || res.status === 429 || res.status >= 500) throw new ProviderError('temporary', message)
        throw new ProviderError('other', code ? `${code}: ${message}` : message)
    }

    const account = (a: any, institutionName: string | null): BankAccount => ({
        providerAccountId: a.account_id,
        name: a.name ?? a.official_name ?? 'Account',
        type: a.type,
        subtype: a.subtype ?? null,
        lastFour: a.mask ?? null,
        institutionName,
    })

    return {
        name: 'plaid',

        async createLinkSession(userId) {
            const data = await call('/link/token/create', {
                client_name: 'Budget Tracker',
                user: { client_user_id: userId },
                products: ['transactions'],
                country_codes: ['US'],
                language: 'en',
            })
            return { linkToken: data.link_token }
        },

        async exchangeLinkResult({ publicToken }) {
            const data = await call('/item/public_token/exchange', { public_token: publicToken })
            return { accessToken: data.access_token, enrollmentId: data.item_id }
        },

        async listAccounts(token): Promise<BankAccount[]> {
            const data = await call('/accounts/get', { access_token: token })
            // Plaid gives the bank's name in its sign-in window, not here
            return (data?.accounts ?? []).map((a: any) => account(a, null))
        },

        async listTransactions(token, providerAccountId, since): Promise<BankTransaction[]> {
            const all: BankTransaction[] = []
            const end = today()
            for (let page = 0, offset = 0; page < MAX_PAGES; page++) {
                const data = await call('/transactions/get', {
                    access_token: token,
                    start_date: since,
                    end_date: end,
                    options: { account_ids: [providerAccountId], count: PAGE_SIZE, offset },
                })
                const batch: any[] = data?.transactions ?? []
                for (const t of batch) {
                    all.push({
                        externalId: t.transaction_id,
                        providerAccountId: t.account_id,
                        date: String(t.date).slice(0, 10),
                        amount: -Number(t.amount),           // Plaid: positive = money out
                        description: t.name ?? t.merchant_name ?? '',
                        pending: !!t.pending,
                    })
                }
                offset += batch.length
                if (batch.length === 0 || offset >= (data?.total_transactions ?? 0)) break
            }
            return all
        },

        async getBalance(token, providerAccountId, accountType): Promise<BankBalance> {
            // /accounts/get returns the latest balances Plaid has (free), rather than a paid live check
            const data = await call('/accounts/get', { access_token: token, options: { account_ids: [providerAccountId] } })
            const b = (data?.accounts ?? [])[0]?.balances ?? {}
            const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))
            const current = num(b.current), available = num(b.available)
            if (accountType === 'credit') {
                return { current: current === null ? null : Math.abs(current), available: available === null ? null : Math.abs(available) }
            }
            return { current, available }
        },

        async disconnect(token) {
            try {
                await call('/item/remove', { access_token: token })
            } catch (e) {
                if (e instanceof ProviderError && e.kind === 'needs_relink') return // already gone
                throw e
            }
        },
    }
}
