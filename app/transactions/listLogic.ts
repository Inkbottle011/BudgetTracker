// Transactions list: running balance, search/filter, sort and CSV export, as plain functions.

interface Tx {
    id: string
    date: string
    type: string
    amount: number | string
    name?: string | null
    note?: string | null
    category_label?: string | null
}

/**
 * Adds a running balance to each transaction and returns them newest first.
 * Matches the dashboard: income, money paid back to you and money taken out of savings add;
 * expenses and money put into savings subtract. Investments and transfers don't change it.
 */
export function withRunningBalance<T extends Tx>(list: T[]): (T & { balance: number })[] {
    const oldestFirst = list
        .map((t, i) => ({ t, i }))
        .sort((a, b) => a.t.date.localeCompare(b.t.date) || a.i - b.i)
    let balance = 0
    return oldestFirst.map(({ t }) => {
        if (t.type === 'income' || t.type === 'reimbursement' || t.type === 'withdrawal') balance += Number(t.amount)
        else if (t.type === 'expense' || t.type === 'savings') balance -= Number(t.amount)
        return { ...t, balance: Math.round(balance * 100) / 100 }
    }).reverse()
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

export function toCSV(rows: (Tx & { balance: number })[]): string {
    const headers = ['Date', 'Type', 'Category', 'Name', 'Amount', 'Details', 'Balance']
    const quote = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    return [
        headers.join(','),
        ...rows.map(t => [t.date, t.type, t.category_label, t.name, t.amount, t.note, t.balance].map(quote).join(',')),
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
