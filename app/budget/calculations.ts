// Budget grid numbers, as plain functions so they can be tested without the screen.
import { parseAmount } from '../../lib/entry'
import type { BudgetType } from './types'

interface Item { id: string; type: BudgetType | string }
interface Amount { budget_item_id: string; month: number; amount: number | string }

const MONTH_NUMBERS = Array.from({ length: 12 }, (_, i) => i + 1)

export function cellAmount(amounts: Amount[], itemId: string, month: number): number {
    const a = amounts.find(a => a.budget_item_id === itemId && a.month === month)
    return a ? Number(a.amount) : 0
}

export function rowTotal(amounts: Amount[], itemId: string): number {
    return MONTH_NUMBERS.reduce((sum, m) => sum + cellAmount(amounts, itemId, m), 0)
}

export function monthTotal(items: Item[], amounts: Amount[], type: BudgetType, month: number): number {
    return items.filter(i => i.type === type).reduce((sum, i) => sum + cellAmount(amounts, i.id, month), 0)
}

export function sectionTotal(items: Item[], amounts: Amount[], type: BudgetType): number {
    return MONTH_NUMBERS.reduce((sum, m) => sum + monthTotal(items, amounts, type, m), 0)
}

/** What's left in a month: income minus expenses, savings and investments. */
export function netByMonth(items: Item[], amounts: Amount[], month: number): number {
    return monthTotal(items, amounts, 'income', month)
        - monthTotal(items, amounts, 'expense', month)
        - monthTotal(items, amounts, 'savings', month)
        - monthTotal(items, amounts, 'investment', month)
}

export function netTotal(items: Item[], amounts: Amount[]): number {
    return MONTH_NUMBERS.reduce((sum, m) => sum + netByMonth(items, amounts, m), 0)
}

/** What someone typed into a budget cell: "1,200" or "$1,200.50" both work; anything unreadable is 0. */
export function parseBudgetInput(value: string): number {
    const n = parseAmount(value)
    return n === null ? 0 : Math.abs(n)
}
