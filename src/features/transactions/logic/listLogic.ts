// Transactions list: search/filter, sort, CSV export and how dates and amounts read, as plain functions.
import { formatMoney } from '../../../shared/money/format'
import { activityDirection } from '../../../shared/money/direction'

interface Tx {
    id: string
    date: string
    type: string
    amount: number | string
    name?: string | null
    note?: string | null
    category_label?: string | null
}

export interface ListFilters {
    search: string
    type: string | null   // 'Income' | 'Expense' | ... or null for all
    from: string          // 'YYYY-MM-DD' or ''
    to: string
    category?: string | null   // a category name, UNCATEGORIZED, or null for all
}

/** The category filter for spending that hasn't been given a category yet. */
export const UNCATEGORIZED = '__uncategorized__'

export type DatePreset = 'all' | 'thisMonth' | 'lastMonth' | 'last30' | 'thisYear' | 'custom'

export const DATE_PRESETS: { value: DatePreset; label: string }[] = [
    { value: 'all', label: 'All time' }, { value: 'thisMonth', label: 'This month' }, { value: 'lastMonth', label: 'Last month' },
    { value: 'last30', label: 'Last 30 days' }, { value: 'thisYear', label: 'This year' }, { value: 'custom', label: 'Pick dates' },
]

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`

/** The dates a preset covers, counted from `today` ('YYYY-MM-DD'). Custom and all-time give blanks. */
export function presetRange(preset: DatePreset, today: string): { from: string; to: string } {
    const [y, m, d] = today.split('-').map(Number)
    if (preset === 'thisMonth') return { from: ymd(new Date(Date.UTC(y, m - 1, 1))), to: ymd(new Date(Date.UTC(y, m, 0))) }
    if (preset === 'lastMonth') return { from: ymd(new Date(Date.UTC(y, m - 2, 1))), to: ymd(new Date(Date.UTC(y, m - 1, 0))) }
    if (preset === 'last30') return { from: ymd(new Date(Date.UTC(y, m - 1, d - 29))), to: today }
    if (preset === 'thisYear') return { from: `${y}-01-01`, to: `${y}-12-31` }
    return { from: '', to: '' }
}

/** "Eating out · Oct 1 – Oct 31": what the list is filtered to, in words ('' when it isn't). */
export function describeFilters(f: { type: string | null; category?: string | null; from: string; to: string }, today: string): string {
    const parts: string[] = []
    if (f.category) parts.push(f.category === UNCATEGORIZED ? 'Uncategorized' : f.category)
    if (f.type) parts.push(f.type)
    if (f.from && f.to) parts.push(`${displayDate(f.from, today)} – ${displayDate(f.to, today)}`)
    else if (f.from) parts.push(`from ${displayDate(f.from, today)}`)
    else if (f.to) parts.push(`until ${displayDate(f.to, today)}`)
    return parts.join(' · ')
}

export function filterTransactions<T extends Tx>(list: T[], f: ListFilters): T[] {
    const q = f.search.trim().toLowerCase()
    return list.filter(t => {
        if (q) {
            const haystack = [t.name, t.note, t.type, t.date, t.category_label].map(v => String(v ?? '').toLowerCase())
            if (!haystack.some(v => v.includes(q))) return false
        }
        if (f.type && t.type !== f.type.toLowerCase()) return false
        if (f.from && t.date < f.from) return false
        if (f.to && t.date > f.to) return false
        if (f.category) {
            const label = String(t.category_label ?? '').trim().toLowerCase()
            if (f.category === UNCATEGORIZED) {
                if (label || t.type === 'transfer') return false
            } else if (label !== f.category.trim().toLowerCase()) return false
        }
        return true
    })
}

export function sortTransactions<T extends Tx>(list: T[], col: string, dir: 'asc' | 'desc'): T[] {
    if (!['date', 'amount', 'type'].includes(col)) return [...list]
    const value = (t: T): string | number => col === 'amount' ? Number(t.amount) : col === 'date' ? t.date : t.type
    const sign = dir === 'asc' ? 1 : -1
    return [...list].sort((a, b) => {
        const va = value(a), vb = value(b)
        return va < vb ? -sign : va > vb ? sign : 0
    })
}

export function toCSV(rows: Tx[]): string {
    const headers = ['Date', 'Type', 'Category', 'Name', 'Amount', 'Details']
    const quote = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    return [
        headers.join(','),
        ...rows.map(t => [t.date, t.type, t.category_label, t.name, t.amount, t.note].map(quote).join(',')),
    ].join('\n')
}

/** Totals for the rows on screen: income, spending net of paybacks, and the difference. */
export function listSummary(rows: Tx[]): { income: number; spent: number; net: number } {
    const sum = (type: string) => rows.filter(t => t.type === type).reduce((s, t) => s + Number(t.amount), 0)
    const round = (n: number) => Math.round(n * 100) / 100
    const income = sum('income')
    const spent = sum('expense') - sum('reimbursement')
    return { income: round(income), spent: round(spent), net: round(income - spent) }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Oct 6", or "Dec 24, 2025" when it isn't this year. `today` is 'YYYY-MM-DD'. */
export function displayDate(date: string, today: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(date))
    if (!m || +m[2] < 1 || +m[2] > 12) return String(date)
    const short = `${MONTHS[+m[2] - 1]} ${+m[3]}`
    return m[1] === today.slice(0, 4) ? short : `${short}, ${m[1]}`
}

/** How an amount reads: "+$20.00" for money in, "-$5.00" for money out, "$100.00" for a transfer. */
export function amountText(t: { type: string; amount: number | string }): { text: string; direction: 'in' | 'out' | 'move' } {
    const direction = activityDirection(t.type)
    const abs = formatMoney(Math.abs(Number(t.amount) || 0))
    return { text: direction === 'in' ? `+${abs}` : direction === 'out' ? `-${abs}` : abs, direction }
}
