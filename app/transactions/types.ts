export const TYPES = ['Income', 'Expense', 'Savings', 'Investment']

// Transactions can also be money paid back to you (a friend's Venmo, a refund), money taken back
// out of savings (lowers what you've saved), or money moved between your own accounts (never
// counted); subscriptions can be none of these
export const TRANSACTION_TYPES = [...TYPES, 'Reimbursement', 'Withdrawal', 'Transfer']

// Type colors live in lib/theme.tsx (typeColors / <TypeBadge>), so they follow light and dark mode

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
    /** The name when editing started, to tell if it was changed */
    startName?: string
    /** The bank's wording for the place (its original name if renamed before) */
    placeName?: string
    /** Rename every transaction from this place, now and in the future */
    renameAll?: boolean
    amount: string
    details: string
    date: string
}