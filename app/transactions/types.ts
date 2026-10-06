export const TYPES = ['Income', 'Expense', 'Savings', 'Investment']

// Transactions can also be money paid back to you (a friend's Venmo, a refund); subscriptions can't
export const TRANSACTION_TYPES = [...TYPES, 'Reimbursement']

export const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
    Income:     { bg: '#2980b9', text: '#fff' },
    Expense:    { bg: '#e74c3c', text: '#fff' },
    Savings:    { bg: '#27ae60', text: '#fff' },
    Investment: { bg: '#8e44ad', text: '#fff' },
    Reimbursement: { bg: '#16a085', text: '#fff' },
}

export const DEFAULT_CATEGORIES: Record<string, string[]> = {
    Income:     ['Salary', 'Freelance', 'Bonus', 'Other'],
    Expense:    ['Food', 'Rent', 'Utilities', 'Transport', 'Entertainment', 'Other'],
    Savings:    ['Emergency Fund', 'Roth IRA', 'General Savings', 'Other'],
    Investment: ['Stocks', 'Crypto', 'Real Estate', 'ETF', 'Other'],
}
// A payback reduces spending in an expense category
DEFAULT_CATEGORIES.Reimbursement = DEFAULT_CATEGORIES.Expense


export interface EditingTransaction {
    id: string
    type: string
    category: string
    name: string
    amount: string
    details: string
    date: string
}