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
    accounts: { id: string; name: string | null; last_four: string | null; type: string | null }[]
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
export async function callBank(action: 'link' | 'sync' | 'unlink', extra: Record<string, unknown> = {}): Promise<any> {
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
    const { data: accounts } = await supabase.from('bank_accounts').select('id, connection_id, name, last_four, type')
    return (banks ?? []).map((b: any) => ({
        ...b,
        accounts: (accounts ?? []).filter((a: any) => a.connection_id === b.id),
    }))
}
