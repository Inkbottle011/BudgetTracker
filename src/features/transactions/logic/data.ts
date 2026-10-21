// Reading transactions for other features. Transactions are only read or changed directly in this feature.
import { supabase } from '../../../shared/supabase'

/** All your transactions, newest first. */
export async function loadAllTransactions() {
    const { data } = await supabase.from('transactions').select('*').order('date', { ascending: false })
    return data ?? null
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
