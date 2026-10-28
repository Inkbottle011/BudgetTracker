// Budget grid numbers, as plain functions so they can be tested without the screen.
import { parseAmount } from '../../../shared/money/entry'
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

/** True when an item isn't the same amount every month of the year (an empty month counts as $0). */
export function varies(amounts: Amount[], itemId: string): boolean {
    const first = cellAmount(amounts, itemId, 1)
    return MONTH_NUMBERS.some(m => cellAmount(amounts, itemId, m) !== first)
}

/** Spending categories your transactions use that aren't in your budget ("Subscribtions"), most used first. */
export function unplannedCategories(
    transactions: { type: string; category_label?: string | null }[],
    items: { name: string; type: string }[],
): { name: string; count: number }[] {
    const planned = new Set(items.filter(i => i.type === 'expense').map(i => i.name.trim().toLowerCase()))
    const found = new Map<string, { names: Map<string, number>; count: number }>()
    for (const t of transactions) {
        if (t.type !== 'expense' && t.type !== 'reimbursement') continue
        const label = String(t.category_label ?? '').trim()
        if (!label || planned.has(label.toLowerCase())) continue
        const f = found.get(label.toLowerCase()) ?? { names: new Map<string, number>(), count: 0 }
        f.names.set(label, (f.names.get(label) ?? 0) + 1)
        f.count++
        found.set(label.toLowerCase(), f)
    }
    return [...found.values()]
        .map(f => ({ name: [...f.names.entries()].sort((a, b) => b[1] - a[1])[0][0], count: f.count }))
        .sort((a, b) => b.count - a.count)
}

/** Budget items in the order you chose: moved ones by position, the rest after them by when they were added. */
export function sortItems<T extends { position?: number | null; created_at?: string | null }>(items: T[]): T[] {
    const pos = (i: T) => (i.position ?? Number.POSITIVE_INFINITY)
    return [...items].sort((a, b) => pos(a) - pos(b) || String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')))
}
