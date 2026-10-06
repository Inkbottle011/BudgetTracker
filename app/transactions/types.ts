export const TYPES = ['Income', 'Expense', 'Savings', 'Investment']

// Transactions can also be money paid back to you (a friend's Venmo, a refund), money taken back
// out of savings (lowers what you've saved), or money moved between your own accounts (never
// counted); subscriptions can be none of these
export const TRANSACTION_TYPES = [...TYPES, 'Reimbursement', 'Withdrawal', 'Transfer']

export const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
    Income:     { bg: '#2980b9', text: '#fff' },
    Expense:    { bg: '#e74c3c', text: '#fff' },
    Savings:    { bg: '#27ae60', text: '#fff' },
    Investment: { bg: '#8e44ad', text: '#fff' },
    Reimbursement: { bg: '#16a085', text: '#fff' },
    Withdrawal: { bg: '#d68910', text: '#fff' },
    Transfer:   { bg: '#7f8c8d', text: '#fff' },
}

export const DEFAULT_CATEGORIES: Record<string, string[]> = {
    Income:     ['Salary', 'Freelance', 'Bonus', 'Other'],
    Expense:    ['Food', 'Rent', 'Utilities', 'Transport', 'Entertainment', 'Other'],
    Savings:    ['Emergency Fund', 'Roth IRA', 'General Savings', 'Other'],
    Investment: ['Stocks', 'Crypto', 'Real Estate', 'ETF', 'Other'],
}
// A payback reduces spending in an expense category
DEFAULT_CATEGORIES.Reimbursement = DEFAULT_CATEGORIES.Expense
// A withdrawal comes out of a savings category
DEFAULT_CATEGORIES.Withdrawal = DEFAULT_CATEGORIES.Savings


export interface EditingTransaction {
    id: string
    type: string
    category: string
    name: string
    amount: string
    details: string
    date: string
}