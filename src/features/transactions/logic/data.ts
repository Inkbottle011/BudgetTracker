// Reading transactions for other features. Transactions are only read or changed directly in this feature.
import { supabase } from '../../../shared/supabase'
import { fetchAllRows } from '../../../shared/fetchAllRows'
import { useTransactionStore } from './useTransactionStore'

/** All your transactions, newest first (every one, past Supabase's 1,000-row limit). Null if it can't load. */
export async function loadAllTransactions(): Promise<any[] | null> {
    try {
        return await fetchAllRows(() => supabase.from('transactions').select('*').order('date', { ascending: false }).order('id'))
    } catch {
        return null
    }
}

/** The date of your newest transaction, as a one-item list (empty when you have none). */
export async function latestTransactionDate(): Promise<{ date: string }[]> {
    const { data } = await supabase.from('transactions').select('date').order('date', { ascending: false }).limit(1)
    return data ?? []
}

/** A few transactions by id, with the details needed to compare them. */
export async function transactionsByIds(ids: string[]): Promise<{ id: string; date: string; amount: number; name: string; note: string }[]> {
    const { data } = await supabase.from('transactions').select('id, date, amount, name, note').in('id', ids)
    return data ?? []
}

/** Moves transactions to another category, a batch at a time. Also updates the list already on screen. */
export async function recategorize(changes: { category: string; ids: string[] }[]): Promise<void> {
    for (const { category, ids } of changes) {
        for (let i = 0; i < ids.length; i += 200) {
            const { error } = await supabase.from('transactions').update({ category_label: category }).in('id', ids.slice(i, i + 200))
            if (error) throw new Error(`Couldn't move your transactions to ${category}: ${error.message}`)
        }
    }
    const to = new Map(changes.flatMap(c => c.ids.map(id => [id, c.category] as const)))
    const store = useTransactionStore.getState()
    if (store.transactions.some(t => to.has(t.id))) {
        store.setTransactions(store.transactions.map(t => (to.has(t.id) ? { ...t, category_label: to.get(t.id)! } : t)))
    }
}

// ---- Deleting with Undo ----

/** What a delete removed or unlinked, so Undo can put it all back. */
export interface DeletedTransactions {
    rows: Record<string, any>[]
    /** Who owed you for these expenses (deleted with them), or shares these paybacks settled (unlinked) */
    shares: Record<string, any>[]
    /** Paybacks that pointed at a deleted expense: payback id -> expense id */
    paybacks: { id: string; reimburses_id: string }[]
}

const chunks = <T,>(list: T[], size = 200) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size))

async function selectIn(table: string, column: string, ids: string[]): Promise<any[]> {
    const out: any[] = []
    for (const part of chunks(ids)) {
        const { data, error } = await supabase.from(table).select('*').in(column, part)
        if (error) throw new Error(error.message)
        out.push(...((data ?? []) as any[]).filter(r => part.includes(r[column])))
    }
    return out
}

/** Deletes transactions and returns everything needed to undo it. */
export async function deleteTransactions(ids: string[]): Promise<DeletedTransactions> {
    let snapshot: DeletedTransactions
    try {
        const rows = await selectIn('transactions', 'id', ids)
        const shares = [...await selectIn('split_shares', 'expense_id', ids), ...await selectIn('split_shares', 'settled_by', ids)]
        const paybacks = (await selectIn('transactions', 'reimburses_id', ids))
            .filter(t => !ids.includes(t.id))
            .map(t => ({ id: t.id as string, reimburses_id: t.reimburses_id as string }))
        snapshot = { rows, shares: [...new Map(shares.map(s => [s.id, s])).values()], paybacks }
    } catch (e: any) {
        throw new Error(`Couldn't delete: ${e.message}`)
    }
    for (const part of chunks(ids)) {
        const { error } = await supabase.from('transactions').delete().in('id', part)
        if (error) throw new Error(`Couldn't delete: ${error.message}`)
    }
    return snapshot
}

/** Puts deleted transactions back with the same ids, then their shares and payback links. */
export async function restoreTransactions({ rows, shares, paybacks }: DeletedTransactions): Promise<void> {
    for (const part of chunks(rows)) {
        const { error } = await supabase.from('transactions').insert(part)
        if (error) throw new Error(`Couldn't bring them back: ${error.message}`)
    }
    if (shares.length) {
        const { error } = await supabase.from('split_shares').upsert(shares, { onConflict: 'id' })
        if (error) throw new Error(`They're back, but who owes you couldn't be restored: ${error.message}`)
    }
    const byExpense = new Map<string, string[]>()
    for (const p of paybacks) byExpense.set(p.reimburses_id, [...(byExpense.get(p.reimburses_id) ?? []), p.id])
    for (const [expense, payIds] of byExpense) {
        const { error } = await supabase.from('transactions').update({ reimburses_id: expense }).in('id', payIds)
        if (error) throw new Error(`They're back, but a payback couldn't be relinked: ${error.message}`)
    }
}

/** The charges a subscription added (so they can be linked again if it's restored). */
export async function subscriptionChargeIds(subscriptionId: string): Promise<string[]> {
    const { data, error } = await supabase.from('transactions').select('id, subscription_id').eq('subscription_id', subscriptionId)
    if (error) throw new Error(error.message)
    return ((data ?? []) as any[]).filter(t => t.subscription_id === subscriptionId).map(t => t.id)
}

/** Links charges back to their subscription. */
export async function linkSubscriptionCharges(ids: string[], subscriptionId: string): Promise<void> {
    for (const part of chunks(ids)) {
        const { error } = await supabase.from('transactions').update({ subscription_id: subscriptionId }).in('id', part)
        if (error) throw new Error(error.message)
    }
}

/** Which transaction types use a budget item's categories: spending and its paybacks, savings and withdrawals... */
const TYPES_FOR_KIND: Record<string, string[]> = {
    expense: ['expense', 'reimbursement'], savings: ['savings', 'withdrawal'], income: ['income'], investment: ['investment'],
}

/**
 * Moves every transaction in one category to another (for renaming or combining categories), only the
 * types that use that kind of category. Returns the ids moved, for Undo.
 */
export async function moveCategory({ from, to, kind }: { from: string; to: string; kind: string }): Promise<string[]> {
    const escaped = from.trim().replace(/[\\%_]/g, m => `\\${m}`)
    const { data, error } = await supabase.from('transactions').select('id, category_label, type').ilike('category_label', escaped)
    if (error) throw new Error(`Couldn't move transactions: ${error.message}`)
    const types = TYPES_FOR_KIND[kind] ?? [kind]
    const ids = ((data ?? []) as any[])
        .filter(t => String(t.category_label ?? '').trim().toLowerCase() === from.trim().toLowerCase() && types.includes(t.type))
        .map(t => t.id as string)
    if (ids.length) await recategorize([{ category: to, ids }])
    return ids
}
