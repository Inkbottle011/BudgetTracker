// Reading transactions for other features. Transactions are only read or changed directly in this feature.
import { supabase } from '../../../shared/supabase'
import { fetchAllRows } from '../../../shared/fetchAllRows'

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
