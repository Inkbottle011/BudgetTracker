// Split expenses: who owes you, and which incoming money could be their payback.
import { parseAmount } from './entry'

export interface SplitShare {
    id: string
    expense_id: string
    person: string
    amount: number | string
    settled_by: string | null
}

interface Tx {
    id: string
    date: string
    type: string
    amount: number | string
    name?: string | null
    category_label?: string | null
    reimburses_id?: string | null
}

const round = (n: number) => Math.round(n * 100) / 100

export interface OwedExpense<T extends Tx> {
    expense: T
    unpaid: SplitShare[]
    outstanding: number
}

/** Everything still owed to you: per expense (newest first), per person (biggest first), and in total. */
export function owedToYou<T extends Tx>(shares: SplitShare[], transactions: T[]) {
    const byId = new Map(transactions.map(t => [t.id, t]))
    const unpaid = shares.filter(s => !s.settled_by && byId.has(s.expense_id))

    const groups = new Map<string, OwedExpense<T>>()
    for (const s of unpaid) {
        const g = groups.get(s.expense_id) ?? { expense: byId.get(s.expense_id)!, unpaid: [], outstanding: 0 }
        g.unpaid.push(s)
        g.outstanding = round(g.outstanding + Number(s.amount))
        groups.set(s.expense_id, g)
    }

    const people = new Map<string, { person: string; amount: number }>()
    for (const s of unpaid) {
        const key = s.person.trim().toLowerCase()
        const p = people.get(key) ?? { person: s.person.trim(), amount: 0 }
        p.amount = round(p.amount + Number(s.amount))
        people.set(key, p)
    }

    return {
        total: round(unpaid.reduce((sum, s) => sum + Number(s.amount), 0)),
        expenses: [...groups.values()].sort((a, b) => b.expense.date.localeCompare(a.expense.date)),
        byPerson: [...people.values()].sort((a, b) => b.amount - a.amount),
    }
}

/** What others owe in total, from the split rows being typed in the form. */
export function totalShares(rows: { person: string; amount: string }[]): number {
    return round(rows.reduce((sum, r) => sum + Math.abs(parseAmount(r.amount) ?? 0), 0))
}

/**
 * Money that came in which could be this person paying you back: income or an unlinked payback
 * for the same amount, up to 60 days after the expense, not already used for another share.
 * Closest to the expense date first. Useful when the Venmo deposit was already imported from your bank.
 */
export function matchingPayments<T extends Tx>(share: SplitShare, expense: T, transactions: T[], allShares: SplitShare[]): T[] {
    const used = new Set(allShares.map(s => s.settled_by).filter(Boolean))
    const latest = new Date(`${expense.date.slice(0, 10)}T12:00:00`)
    latest.setDate(latest.getDate() + 60)
    const until = `${latest.getFullYear()}-${String(latest.getMonth() + 1).padStart(2, '0')}-${String(latest.getDate()).padStart(2, '0')}`
    return transactions
        .filter(t =>
            (t.type === 'income' || (t.type === 'reimbursement' && !t.reimburses_id))
            && !used.has(t.id)
            && Math.abs(Number(t.amount) - Number(share.amount)) < 0.005
            && t.date >= expense.date && t.date <= until)
        .sort((a, b) => a.date.localeCompare(b.date))
}
