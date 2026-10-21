export type TransactionType = 'income' | 'expense' | 'savings' | 'investment'

export interface Category {
    id: string
    user_id: string
    name: string
    icon: string
    color: string
    type: TransactionType
    created_at: string
}

export interface Transaction {
    id: string
    user_id: string
    category_id: string
    amount: number
    type: TransactionType
    note?: string
    name?: string
    /** The bank's or file's wording, kept when you rename a transaction */
    original_name?: string | null
    category_label?: string
    date: string
    created_at: string
    category?: Category
    recurring?: string        // old repeat system, no longer used
    recurring_end?: string    // old repeat system, no longer used
    subscription_id?: string | null
}

export interface Budget {
    id: string
    user_id: string
    category_id: string
    amount: number
    month: number
    year: number
    created_at: string
    category?: Category
}