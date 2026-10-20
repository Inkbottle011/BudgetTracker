// Transactions list: search/filter, sort, CSV export and how dates and amounts read, as plain functions.
import { formatMoney } from '../../../shared/money/format'
import { activityDirection } from '../../dashboard/logic/summary'

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
