// Dashboard numbers, as plain functions so they can be tested without the screen.

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export type View = 'month' | 'year'

interface Tx { date: string; type: string; amount: number | string; category_label?: string | null }
interface PlannedAmount { budget_item_id: string; month: number; amount: number | string }

/**
 * Year, month and day exactly as written in a 'YYYY-MM-DD' date.
 * (new Date('2026-10-01') means midnight UTC, which is still Sept 30 in the US.)
 */
export function dateParts(date: string): { year: number; month: number; day: number } {
    const [year, month, day] = String(date).slice(0, 10).split('-').map(Number)
    return { year, month, day }
}

export function inPeriod(t: { date: string }, view: View, year: number, month: number): boolean {
    const d = dateParts(t.date)
    return d.year === year && (view === 'year' || d.month === month)
}

export function sumByType(list: Tx[], type: string): number {
    return list.filter(t => t.type === type).reduce((s, t) => s + Number(t.amount), 0)
}

/** Totals for one year, plus the all-time balance (income minus expenses). */
export function overview(all: Tx[], year: number) {
    const yearList = all.filter(t => dateParts(t.date).year === year)
    return {
        income: sumByType(yearList, 'income'),
        expenses: sumByType(yearList, 'expense'),
        savings: sumByType(yearList, 'savings'),
        balance: sumByType(all, 'income') - sumByType(all, 'expense'),
    }
}

export function plannedAmount(amounts: PlannedAmount[], itemId: string, view: View, month: number): number {
    const mine = amounts.filter(a => a.budget_item_id === itemId)
    const used = view === 'month' ? mine.filter(a => a.month === month) : mine
    return used.reduce((s, a) => s + Number(a.amount), 0)
}

export function actualAmount(periodList: Tx[], itemName: string, itemType: string): number {
    return periodList
        .filter(t => t.category_label === itemName && t.type === itemType)
        .reduce((s, t) => s + Number(t.amount), 0)
}

export function spendingByCategory(periodList: Tx[]): { label: string; amount: number }[] {
    const grouped: Record<string, number> = {}
    for (const t of periodList) {
        if (t.type !== 'expense') continue
        const key = t.category_label || 'Other'
        grouped[key] = (grouped[key] || 0) + Number(t.amount)
    }
    return Object.entries(grouped)
        .map(([label, amount]) => ({ label, amount }))
        .sort((a, b) => b.amount - a.amount)
}

export function periodLabel(view: View, year: number, month: number): string {
    return view === 'year' ? String(year) : `${MONTHS[month - 1]} ${year}`
}

export interface TrendMonth { month: number; year: number; label: string }

/** The months the trend chart shows: the last 6 up to today, or all 12 of the selected year. */
export function trendMonths(today: Date, showAll: boolean, selectedYear: number): TrendMonth[] {
    if (showAll) return MONTHS.map((label, i) => ({ month: i + 1, year: selectedYear, label }))
    return Array.from({ length: 6 }, (_, i) => {
        const d = new Date(today.getFullYear(), today.getMonth() - 5 + i, 1)
        return { month: d.getMonth() + 1, year: d.getFullYear(), label: MONTHS[d.getMonth()] }
    })
}

export function monthlyTrend(list: Tx[], months: TrendMonth[]) {
    return months.map(({ month, year, label }) => {
        const inMonth = list.filter(t => { const d = dateParts(t.date); return d.year === year && d.month === month })
        const income = sumByType(inMonth, 'income')
        const expense = sumByType(inMonth, 'expense')
        return { label, income, expense, net: income - expense }
    })
}

/**
 * How well spending is tracking the yearly expense budget.
 * Score is 100 at or under budget and drops by the share spent over it (20% over = 80).
 */
export function budgetHealth(
    items: { id: string; name: string; type: string }[],
    amounts: PlannedAmount[],
    list: Tx[],
    year: number,
) {
    let planned = 0, actual = 0, overBudgetCount = 0
    for (const item of items.filter(i => i.type === 'expense')) {
        const p = plannedAmount(amounts, item.id, 'year', 1)
        const a = list
            .filter(t => t.category_label === item.name && t.type === 'expense' && dateParts(t.date).year === year)
            .reduce((s, t) => s + Number(t.amount), 0)
        planned += p
        actual += a
        if (a > p && p > 0) overBudgetCount++
    }
    const score = planned > 0
        ? Math.max(0, Math.min(100, Math.round((1 - (actual - planned) / planned) * 100)))
        : null
    return { score, planned, actual, overBudgetCount }
}
