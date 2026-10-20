// Numbers for the dashboard, all for one period (a month or a year).
import { isSavingsAccount, BankAccountRow } from '../../bank/api'
import { sumByType, netSpent, netSaved, actualAmount } from './calculations'

export type Period = 'day' | 'week' | 'month' | 'year'
/** Dates as 'YYYY-MM-DD'; start is included, end is not. */
export interface Range { start: string; end: string }
interface Tx { date: string; type: string; amount: number | string; category_label?: string | null }

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAY = 86_400_000

// Date math on the calendar date itself (UTC), so time zones never shift a day
const toUTC = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10))
const fromUTC = (ms: number) => new Date(ms).toISOString().slice(0, 10)
const addDaysTo = (d: string, n: number) => fromUTC(toUTC(d) + n * DAY)
const daysBetween = (a: string, b: string) => Math.round((toUTC(b) - toUTC(a)) / DAY)
const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate()
const round = (n: number) => Math.round(n * 100) / 100

/** The day, week (Monday to Sunday), month or year that `anchor` falls in. */
export function periodRange(view: Period, anchor: string): Range {
    const y = +anchor.slice(0, 4), m = +anchor.slice(5, 7)
    if (view === 'day') return { start: anchor, end: addDaysTo(anchor, 1) }
    if (view === 'week') {
        const sinceMonday = (new Date(toUTC(anchor)).getUTCDay() + 6) % 7
        const start = addDaysTo(anchor, -sinceMonday)
        return { start, end: addDaysTo(start, 7) }
    }
    if (view === 'month') return { start: fromUTC(Date.UTC(y, m - 1, 1)), end: fromUTC(Date.UTC(y, m, 1)) }
    return { start: `${y}-01-01`, end: `${y + 1}-01-01` }
}

/** The same kind of period, one step back (-1) or forward (+1). */
export function shiftAnchor(view: Period, anchor: string, step: number): string {
    const y = +anchor.slice(0, 4), m = +anchor.slice(5, 7)
    if (view === 'day') return addDaysTo(anchor, step)
    if (view === 'week') return addDaysTo(anchor, 7 * step)
    if (view === 'month') return fromUTC(Date.UTC(y, m - 1 + step, 1))
    return `${y + step}-01-01`
}

const short = (d: string) => `${MONTH_NAMES[+d.slice(5, 7) - 1].slice(0, 3)} ${+d.slice(8, 10)}`

/** "Today", "Mon, Oct 5", "Oct 11 – 17", "October 2026", "2026" */
export function periodTitle(view: Period, range: Range, today: string): string {
    if (view === 'day') {
        if (range.start === today) return 'Today'
        if (range.start === addDaysTo(today, -1)) return 'Yesterday'
        const weekday = new Date(toUTC(range.start)).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
        return `${weekday}, ${short(range.start)}`
    }
    if (view === 'week') {
        const last = addDaysTo(range.end, -1)
        return last.slice(5, 7) === range.start.slice(5, 7) ? `${short(range.start)} – ${+last.slice(8, 10)}` : `${short(range.start)} – ${short(last)}`
    }
    if (view === 'month') return `${MONTH_NAMES[+range.start.slice(5, 7) - 1]} ${range.start.slice(0, 4)}`
    return range.start.slice(0, 4)
}

export const inRange = (date: string, r: Range) => {
    const d = String(date).slice(0, 10)
    return d >= r.start && d < r.end
}

/** Your plan for a budget item over the range: each month's amount spread evenly over its days. */
export function plannedForRange(amounts: { budget_item_id: string; month: number; year?: number; amount: number | string }[], itemId: string, r: Range): number {
    const mine = amounts.filter(a => a.budget_item_id === itemId)
    let total = 0
    let day = r.start
    while (day < r.end) {
        const y = +day.slice(0, 4), m = +day.slice(5, 7)
        const monthEnd = fromUTC(Date.UTC(y, m, 1))
        const until = monthEnd < r.end ? monthEnd : r.end
        const days = daysBetween(day, until)
        const amount = mine.filter(a => a.month === m && (a.year === undefined || a.year === null || a.year === y))
            .reduce((s, a) => s + Number(a.amount), 0)
        total += amount * (days / daysInMonth(y, m))
        day = until
    }
    return round(total)
}

/** How much of the range has gone by on `today`, counting today: 0 before it starts, 1 once it's over. */
export function periodElapsed(r: Range, today: string): number {
    if (today < r.start) return 0
    if (today >= r.end) return 1
    return (daysBetween(r.start, today) + 1) / daysBetween(r.start, r.end)
}

/** Days still to come after today, while the range is going on; null for past or future ranges. */
export function daysLeftAfterToday(r: Range, today: string): number | null {
    if (today < r.start || today >= r.end) return null
    return daysBetween(today, r.end) - 1
}

/** Earned, spent (net of paybacks), saved (net of withdrawals), and what's left of what you earned. */
export function periodSummary(list: Tx[], r: Range) {
    const inside = list.filter(t => inRange(t.date, r))
    const income = round(sumByType(inside as any, 'income'))
    const spent = round(netSpent(inside as any))
    const saved = round(netSaved(inside as any))
    return { income, spent, saved, left: round(income - spent) }
}

export interface BudgetRow { name: string; planned: number; spent: number; left: number }

/**
 * One row per spending category: your budget's categories, plus any you spent in without a budget.
 * Overspent categories first (most over first), then by amount spent.
 */
export function budgetRows(items: { id: string; name: string; type: string }[], amounts: any[], list: Tx[], r: Range) {
    const periodList = list.filter(t => inRange(t.date, r))
    const spending = items.filter(i => i.type === 'expense')
    const rows: BudgetRow[] = spending.map(i => {
        const planned = plannedForRange(amounts, i.id, r)
        const spent = round(actualAmount(periodList as any, i.name, 'expense'))
        return { name: i.name, planned, spent, left: round(planned - spent) }
    })
    const known = new Set(spending.map(i => i.name))
    const others = new Set(periodList.filter(t => (t.type === 'expense' || t.type === 'reimbursement') && t.category_label && !known.has(t.category_label))
        .map(t => String(t.category_label)))
    for (const name of others) {
        const spent = round(actualAmount(periodList as any, name, 'expense'))
        if (spent > 0) rows.push({ name, planned: 0, spent, left: round(-spent) })
    }
    const over = (r: BudgetRow) => r.planned > 0 && r.spent > r.planned
    rows.sort((a, b) => Number(over(b)) - Number(over(a)) || (over(a) ? a.left - b.left : b.spent - a.spent))

    const uncategorized = round(netSpent(periodList.filter(t => !(t.category_label ?? '').trim()) as any))
    const totalPlanned = round(rows.reduce((s, r) => s + r.planned, 0))
    return { rows, uncategorized, totalPlanned }
}

/** Income and savings categories against the plan. */
export function goalRows(items: { id: string; name: string; type: string }[], amounts: any[], list: Tx[], r: Range) {
    const periodList = list.filter(t => inRange(t.date, r))
    return items.filter(i => i.type === 'income' || i.type === 'savings').map(i => ({
        name: i.name,
        type: i.type,
        planned: plannedForRange(amounts, i.id, r),
        actual: round(actualAmount(periodList as any, i.name, i.type)),
    }))
}

export interface AccountGroup { total: number; accounts: (BankAccountRow & { balance: number | null })[] }

/** Linked accounts in three groups: checking (spending money), savings and vaults, and cards (owed). */
export function accountsSummary(accounts: BankAccountRow[]) {
    const group = (list: BankAccountRow[]): AccountGroup => {
        const withBalance = list.map(a => ({ ...a, balance: a.balance_current === null || a.balance_current === undefined ? null : Number(a.balance_current) }))
        return { total: round(withBalance.reduce((s, a) => s + (a.balance ?? 0), 0)), accounts: withBalance }
    }
    const cards = accounts.filter(a => a.type === 'credit')
    const savings = accounts.filter(a => isSavingsAccount(a))
    const cash = accounts.filter(a => a.type === 'depository' && !isSavingsAccount(a))
    return { cash: group(cash), savings: group(savings), cards: group(cards), any: accounts.length > 0 }
}

export { activityDirection } from '../../../shared/money/direction'

export type BudgetTone = 'unplanned' | 'onTrack' | 'close' | 'over'
/** How a category is doing against its plan: under 85% is on track, up to 100% is close, then over. */
export function budgetTone(spent: number, planned: number): BudgetTone {
    if (planned <= 0) return 'unplanned'
    if (spent > planned) return 'over'
    return spent / planned >= 0.85 ? 'close' : 'onTrack'
}
