// Teller plug-in: the only file that knows about Teller's API.
// Docs: https://teller.io/docs/api — Basic auth with the access token as username; in development and
// production Teller also requires a client certificate (mTLS), which the server function supplies
// through the `fetch` it passes in.
import { BankAccount, BankProvider, BankTransaction, ProviderError } from './types.ts'

type FetchLike = (url: string, init?: any) => Promise<{ ok: boolean; status: number; json(): Promise<any>; text(): Promise<string> }>

const PAGE_SIZE = 250
const MAX_PAGES = 100

export function createTellerProvider({ fetch, baseUrl = 'https://api.teller.io' }: { fetch: FetchLike; baseUrl?: string }): BankProvider {
    async function call(token: string, path: string, method = 'GET') {
        let res
        try {
            res = await fetch(`${baseUrl}${path}`, {
                method,
                headers: { Authorization: `Basic ${btoa(`${token}:`)}`, Accept: 'application/json' },
            })
        } catch (e: any) {
            throw new ProviderError('temporary', `Couldn't reach Teller: ${e?.message ?? 'network error'}`)
        }
        if (res.ok) return res.status === 204 ? null : res.json()

        let code = '', message = `Teller returned ${res.status}`
        try {
            const body = await res.json()
            code = body?.error?.code ?? ''
            if (body?.error?.message) message = body.error.message
        } catch { /* not JSON */ }
        if (res.status === 401 || res.status === 403 || code.startsWith('enrollment.')) throw new ProviderError('needs_relink', message)
        if (res.status === 429 || res.status >= 500) throw new ProviderError('temporary', message)
        throw new ProviderError('other', message)
    }

    return {
        name: 'teller',

        async listAccounts(token): Promise<BankAccount[]> {
            const accounts = await call(token, '/accounts')
            return (accounts ?? []).map((a: any) => ({
                providerAccountId: a.id,
                name: a.name,
                type: a.type,
                subtype: a.subtype ?? null,
                lastFour: a.last_four ?? null,
                institutionName: a.institution?.name ?? null,
            }))
        },

        async listTransactions(token, providerAccountId, since): Promise<BankTransaction[]> {
            const all: BankTransaction[] = []
            let fromId: string | null = null
            for (let page = 0; page < MAX_PAGES; page++) {
                const params = new URLSearchParams({ count: String(PAGE_SIZE), start_date: since })
                if (fromId) params.set('from_id', fromId)
                const batch: any[] = await call(token, `/accounts/${encodeURIComponent(providerAccountId)}/transactions?${params}`) ?? []
                if (batch.length === 0) break
                for (const t of batch) {
                    if (t.date < since) continue
                    all.push({
                        externalId: t.id,
                        providerAccountId: t.account_id ?? providerAccountId,
                        date: String(t.date).slice(0, 10),
                        amount: Number(t.amount),
                        description: t.description ?? '',
                        pending: t.status === 'pending',
                    })
                }
                fromId = batch[batch.length - 1].id
                if (batch[batch.length - 1].date < since) break
            }
            return all
        },

        async disconnect(token) {
            try {
                await call(token, '/accounts', 'DELETE')
            } catch (e) {
                // Already gone at Teller: nothing left to remove
                if (e instanceof ProviderError && e.kind === 'needs_relink') return
                if (e instanceof ProviderError && e.message.includes('not_found')) return
                throw e
            }
        },
    }
}
