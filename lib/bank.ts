// Linked banks, from the app's side. All bank access happens in the "bank" server function;
// the app never sees or stores a bank token.
import { supabase } from './supabase'
import { addDays } from './subscriptions'

export interface LinkedBank {
    id: string
    institution_name: string | null
    status: 'active' | 'error' | 'needs_relink'
    last_error: string | null
    last_synced_at: string | null
    sync_from: string
    accounts: BankAccountRow[]
}

export interface BankAccountRow {
    id: string
    name: string | null
    last_four: string | null
    type: string | null
    balance_current?: number | string | null
    balance_available?: number | string | null
    balance_updated_at?: string | null
}

const toNumber = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v))

export function formatBalance(n: number | null | undefined): string {
    if (n === null || n === undefined || Number.isNaN(n)) return '—'
    const s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return `${n < 0 ? '-' : ''}$${s}`
}

/** Usage at or above this share of the limit is flagged (it starts to affect credit scores). */
export const HIGH_CARD_USAGE = 30

/** Linked credit cards: what's owed, credit left, and share of the limit used, plus totals. */
export function cardSummary(accounts: BankAccountRow[]) {
    const usedPercent = (owed: number | null, available: number | null) =>
        owed === null || available === null || owed + available <= 0 ? null : Math.round((owed / (owed + available)) * 100)
    const cards = accounts.filter(a => a.type === 'credit').map(a => {
        const owed = toNumber(a.balance_current), available = toNumber(a.balance_available)
        return { ...a, owed, available, usedPercent: usedPercent(owed, available) }
    })
    const known = cards.filter(c => c.owed !== null)
    const round = (n: number) => Math.round(n * 100) / 100
    const totalOwed = round(known.reduce((s, c) => s + (c.owed ?? 0), 0))
    const totalAvailable = round(known.reduce((s, c) => s + (c.available ?? 0), 0))
    return { cards, totalOwed, totalAvailable, usedPercent: known.length ? usedPercent(totalOwed, totalAvailable) : null }
}

/** One line for an account in Settings, e.g. "Sapphire ••9876 · $812.40 owed". */
export function accountLabel(a: BankAccountRow): string {
    const base = `${a.name ?? 'Account'}${a.last_four ? ` ••${a.last_four}` : ''}`
    const bal = toNumber(a.balance_current)
    if (bal === null) return base
    return `${base} · ${formatBalance(bal)}${a.type === 'credit' ? ' owed' : ''}`
}

/** "Updated 3 hours ago" for a balance timestamp. */
export function updatedAgo(iso: string, now = new Date()): string {
    return describeStatus({ status: 'active', last_error: null, last_synced_at: iso }, now).replace('Synced', 'Updated')
}

/**
 * Where importing should start for a newly linked bank: the day after your latest transaction,
 * so nothing you already have is imported twice. With nothing recent, the last 30 days.
 */
export function suggestedStartDate(transactions: { date: string }[], today: string): string {
    const latest = transactions.map(t => String(t.date).slice(0, 10)).sort().at(-1)
    if (!latest || latest < addDays(today, -90)) return addDays(today, -30)
    const next = addDays(latest, 1)
    return next > today ? today : next
}

export function describeStatus(bank: Pick<LinkedBank, 'status' | 'last_error' | 'last_synced_at'>, now = new Date()): string {
    if (bank.status === 'needs_relink') return 'Needs relinking: the bank stopped sharing data'
    if (bank.status === 'error') return `Last sync failed: ${bank.last_error ?? 'unknown error'}`
    if (!bank.last_synced_at) return 'Not synced yet'
    const minutes = Math.max(0, Math.round((now.getTime() - new Date(bank.last_synced_at).getTime()) / 60000))
    const plural = (n: number, unit: string) => `Synced ${n} ${unit}${n === 1 ? '' : 's'} ago`
    if (minutes < 60) return plural(minutes, 'minute')
    if (minutes < 60 * 24) return plural(Math.round(minutes / 60), 'hour')
    return plural(Math.round(minutes / (60 * 24)), 'day')
}

export class BankError extends Error {
    constructor(message: string, public code?: string) { super(message) }
}

/** Calls the bank server function, turning its errors into readable messages. */
export async function callBank(action: 'link' | 'link-session' | 'sync' | 'unlink', extra: Record<string, unknown> = {}): Promise<any> {
    const { data, error } = await supabase.functions.invoke('bank', { body: { action, ...extra } })
    if (!error) return data
    let body: any = null
    try { body = await (error as any).context?.json?.() } catch { /* no body */ }
    if (body?.error) throw new BankError(body.error, body.code)
    throw new BankError("Couldn't reach the bank service. Check your connection and try again.")
}

export async function fetchLinkedBanks(): Promise<LinkedBank[]> {
    const { data: banks, error } = await supabase.from('bank_connections')
        .select('id, institution_name, status, last_error, last_synced_at, sync_from')
        .order('created_at')
    if (error) throw new Error(error.message)
    const { data: accounts } = await supabase.from('bank_accounts')
        .select('id, connection_id, name, last_four, type, balance_current, balance_available, balance_updated_at')
    return (banks ?? []).map((b: any) => ({
        ...b,
        accounts: (accounts ?? []).filter((a: any) => a.connection_id === b.id),
    }))
}
