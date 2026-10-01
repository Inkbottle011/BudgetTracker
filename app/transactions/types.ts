export const TYPES = ['Income', 'Expense', 'Savings', 'Investment']

export const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
    Income:     { bg: '#2980b9', text: '#fff' },
    Expense:    { bg: '#e74c3c', text: '#fff' },
    Savings:    { bg: '#27ae60', text: '#fff' },
    Investment: { bg: '#8e44ad', text: '#fff' },
}

export const DEFAULT_CATEGORIES: Record<string, string[]> = {
    Income:     ['Salary', 'Freelance', 'Bonus', 'Other'],
    Expense:    ['Food', 'Rent', 'Utilities', 'Transport', 'Entertainment', 'Other'],
    Savings:    ['Emergency Fund', 'Roth IRA', 'General Savings', 'Other'],
    Investment: ['Stocks', 'Crypto', 'Real Estate', 'ETF', 'Other'],
}

export interface EditingTransaction {
    id: string
    type: string
    category: string
    name: string
    amount: string
    details: string
    date: string
}