export type BudgetType = 'income' | 'expense' | 'savings' | 'investment'

export interface BudgetItem {
    id: string
    user_id: string
    name: string
    type: BudgetType
    is_fixed: boolean
    created_at: string
    /** Where it sits in its section; empty if never moved */
    position?: number | null
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

export const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
]

export const SECTIONS: BudgetType[] = ['income', 'expense', 'savings', 'investment']

/** What each section is called on screen, and the noun used in "Add a … item". */
export const SECTION_LABELS: Record<BudgetType, { title: string; noun: string; example: string }> = {
    income:     { title: 'Income',      noun: 'income',     example: 'Paycheck' },
    expense:    { title: 'Spending',    noun: 'spending',   example: 'Groceries' },
    savings:    { title: 'Savings',     noun: 'savings',    example: 'Roth IRA' },
    investment: { title: 'Investments', noun: 'investment', example: 'Index fund' },
}

/** The "fill right" button: from January it's every month, otherwise this month through December. */
export function fillLabel(month: number): string {
    return month === 1 ? 'Save for every month' : `Save for ${MONTHS[month - 1]} to Dec`
}
