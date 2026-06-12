export type BudgetType = 'income' | 'expense' | 'savings' | 'investment'

export interface BudgetItem {
    id: string
    user_id: string
    name: string
    type: BudgetType
    is_fixed: boolean
    created_at: string
}

export interface BudgetAmount {
    id: string
    user_id: string
    budget_item_id: string
    month: number
    year: number
    amount: number
}

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const SECTION_COLORS = {
    income:     { header: '#2980b9', light: '#EBF5FB', border: '#2980b9', text: '#1a5276' },
    expense:    { header: '#e74c3c', light: '#FDEDEC', border: '#e74c3c', text: '#922b21' },
    savings:    { header: '#27ae60', light: '#EAFAF1', border: '#27ae60', text: '#1e8449' },
    investment: { header: '#8e44ad', light: '#F5EEF8', border: '#8e44ad', text: '#6c3483' },
}