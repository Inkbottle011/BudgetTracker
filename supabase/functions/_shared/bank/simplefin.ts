// SimpleFIN plug-in: the only file that knows about SimpleFIN. Each person pays SimpleFIN Bridge themselves
// ($15 a year), links their banks there, and pastes a one-time setup token into the app.
// Protocol: https://www.simplefin.org/protocol.html
//   setup token  = base64 of a claim URL; POST to it once and get back an access URL
//   access URL   = https://user:password@host/simplefin, used with Basic auth; it's the lasting "token"
//   GET /accounts?start-date=…&end-date=…&pending=1  (Unix times; amounts are text, money in positive)
import { BankAccount, BankBalance, BankProvider, BankTransaction, ProviderError } from './types.ts'

type FetchLike = (url: string, init?: any) => Promise<{ ok: boolean; status: number; json(): Promise<any>; text(): Promise<string> }>

/** Only SimpleFIN's own servers: a pasted token can never make the server call anywhere else. */
export const SIMPLEFIN_HOSTS = ['bridge.simplefin.org', 'beta-bridge.simplefin.org']
const WINDOW_DAYS = 60          // history is asked for a couple of months at a time
const DAY = 86400

const toEpoch = (date: string) => Math.floor(Date.parse(`${date}T00:00:00Z`) / 1000)
const toDate = (epoch: number) => new Date(epoch * 1000).toISOString().slice(0, 10)
const addDays = (date: string, days: number) => toDate(toEpoch(date) + days * DAY)
const money = (v: unknown) => (v === null || v === undefined || v === '' ? null : Math.round(Number(v) * 100) / 100)

function checkHost(raw: string, what: string): URL {
    let url: URL
    try { url = new URL(raw) } catch { throw new Error(`That isn't a SimpleFIN ${what}.`) }
    if (url.protocol !== 'https:' || !SIMPLEFIN_HOSTS.includes(url.hostname)) throw new Error(`That isn't a SimpleFIN ${what}.`)
    return url
}

/** "Everyday Checking (1234)" -> name and last four digits, when the name ends with them. */
function splitName(raw: string): { name: string; lastFour: string | null } {
    const m = /^(.*?)\s*\(\s*(?:[x*.•]+\s*)?(\d{4})\s*\)\s*$/i.exec(raw ?? '')
    return m && m[1] ? { name: m[1], lastFour: m[2] } : { name: raw ?? 'Account', lastFour: null }
}

/** SimpleFIN doesn't say what kind of account it is: guess from the name, and money owed (a negative balance). */
function kindOf(name: string, balance: number | null): { type: string; subtype: string } {
    if (/checking|savings|money market|deposit/i.test(name)) {
        return { type: 'depository', subtype: /saving/i.test(name) ? 'savings' : /money market/i.test(name) ? 'money market' : 'checking' }
    }
    if (/credit|card|visa|master\s?card|amex|american express|discover/i.test(name) || (balance !== null && balance < 0)) {
        return { type: 'credit', subtype: 'credit_card' }
    }
    return { type: 'depository', subtype: 'checking' }
}

async function sha256Hex(text: string) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export function createSimplefinProvider({ fetch, today = () => new Date().toISOString().slice(0, 10) }: {
    fetch: FetchLike
    today?: () => string
}): BankProvider {
    // One sync asks once for all accounts, then each account takes its part
    const cache = new Map<string, Promise<any[]>>()

    async function get(accessUrl: string, query: string) {
        const url = checkHost(accessUrl, 'access link')
        const auth = `Basic ${btoa(`${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`)}`
        url.username = ''
        url.password = ''
        const base = url.toString().replace(/\/$/, '')
        let res
        try {
            res = await fetch(`${base}/accounts?${query}`, { headers: { Authorization: auth, Accept: 'application/json' } })
        } catch (e: any) {
            throw new ProviderError('temporary', `Couldn't reach SimpleFIN: ${e?.message ?? 'network error'}`)
        }
        if (res.status === 402) throw new ProviderError('needs_relink', 'Your SimpleFIN subscription needs renewing at bridge.simplefin.org.')
        if (res.status === 401 || res.status === 403) throw new ProviderError('needs_relink', 'SimpleFIN access was removed. Link it again with a new setup token.')
        if (res.status === 429 || res.status >= 500) throw new ProviderError('temporary', `SimpleFIN returned ${res.status}. It will try again later.`)
        if (!res.ok) throw new ProviderError('other', `SimpleFIN returned ${res.status}`)
        const body = await res.json()
        const errs: { code?: string; msg?: string }[] = Array.isArray(body?.errlist) ? body.errlist : []
        if (!(body?.accounts ?? []).length && errs.some(e => /^(gen|con)\.auth/.test(e.code ?? ''))) {
            throw new ProviderError('needs_relink', errs[0].msg ?? 'Your bank needs signing in again at SimpleFIN Bridge.')
        }
        const banks = new Map<string, string>((body?.connections ?? []).map((c: any) => [c.conn_id, c.name ?? c.org_name]))
        return (body?.accounts ?? []).map((a: any) => ({ ...a, bankName: a.org?.name ?? banks.get(a.conn_id) ?? null }))
    }

    function balances(token: string) {
        const key = `${token}|balances`
        if (!cache.has(key)) cache.set(key, get(token, 'balances-only=1'))
        return cache.get(key)!
    }

    function history(token: string, since: string) {
        const key = `${token}|${since}`
        if (!cache.has(key)) {
            cache.set(key, (async () => {
                const byAccount = new Map<string, any>()
                const end = addDays(today(), 1)
                for (let from = since; from < end; from = addDays(from, WINDOW_DAYS)) {
                    const to = addDays(from, WINDOW_DAYS) < end ? addDays(from, WINDOW_DAYS) : end
                    const part = await get(token, `start-date=${toEpoch(from)}&end-date=${toEpoch(to)}&pending=1`)
                    for (const a of part) {
                        const seen = byAccount.get(a.id) ?? { ...a, transactions: [] }
                        seen.transactions.push(...(a.transactions ?? []))
                        byAccount.set(a.id, seen)
                    }
                }
                return [...byAccount.values()]
            })())
        }
        return cache.get(key)!
    }

    return {
        name: 'simplefin',

        async exchangeLinkResult({ publicToken }) {
            let claimUrl = ''
            try { claimUrl = atob(publicToken.trim()) } catch { throw new Error("That isn't a SimpleFIN setup token. Copy it again from SimpleFIN Bridge.") }
            checkHost(claimUrl, 'setup token. Copy it again from SimpleFIN Bridge')
            let res
            try {
                res = await fetch(claimUrl, { method: 'POST', headers: { 'Content-Length': '0' } })
            } catch (e: any) {
                throw new ProviderError('temporary', `Couldn't reach SimpleFIN: ${e?.message ?? 'network error'}`)
            }
            if (res.status === 403) {
                throw new Error("This setup token has already been used. If that wasn't you, disable it in SimpleFIN Bridge, then make a new one.")
            }
            if (!res.ok) throw new Error(`SimpleFIN couldn't use that setup token (${res.status}). Make a new one and try again.`)
            const accessToken = (await res.text()).trim()
            checkHost(accessToken, 'access link')
            return { accessToken, enrollmentId: (await sha256Hex(accessToken)).slice(0, 32) }
        },

        async listAccounts(token): Promise<BankAccount[]> {
            return (await balances(token)).map((a: any) => {
                const { name, lastFour } = splitName(a.name)
                return { providerAccountId: String(a.id), name, ...kindOf(name, money(a.balance)), lastFour, institutionName: a.bankName ?? null }
            })
        },

        async listTransactions(token, providerAccountId, since): Promise<BankTransaction[]> {
            const account = (await history(token, since)).find((a: any) => String(a.id) === providerAccountId)
            const out = new Map<string, BankTransaction>()
            for (const t of account?.transactions ?? []) {
                const posted = Number(t.posted) > 0 ? toDate(Number(t.posted)) : null
                const date = t.transacted_at ? toDate(Number(t.transacted_at)) : posted ?? today()
                if (date < since) continue
                out.set(String(t.id), {
                    externalId: String(t.id),
                    providerAccountId,
                    date,
                    ...(posted && posted !== date ? { postedDate: posted } : {}),
                    amount: Number(t.amount),
                    description: t.description ?? t.payee ?? '',
                    pending: t.pending === true || Number(t.posted) === 0,
                })
            }
            return [...out.values()]
        },

        async getBalance(token, providerAccountId, accountType): Promise<BankBalance> {
            const a = (await balances(token)).find((x: any) => String(x.id) === providerAccountId)
            const current = money(a?.balance), available = money(a?.['available-balance'] ?? a?.balance)
            // Cards: what's owed and credit left, both as positive numbers
            if (accountType === 'credit') return { current: current === null ? null : Math.abs(current), available: available === null ? null : Math.abs(available) }
            return { current, available }
        },

        /** SimpleFIN has no way for an app to give up its access: the person removes the app in SimpleFIN Bridge. */
        async disconnect() {},
    }
}
