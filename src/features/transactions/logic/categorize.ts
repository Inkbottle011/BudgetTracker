// Finding transactions without a category and suggesting one, so they can be categorized a whole
// place at a time ("TACOS TEXAS x3 -> Food") instead of one by one.
import { merchantKey, keywordCategory, placeGroups } from '../../../shared/money/entry'

export interface UncategorizedGroup {
    key: string
    name: string          // how the place appears (its most common spelling)
    type: string
    ids: string[]
    count: number
    total: number
    suggestion: string | null
}

/** Categories you can pick for each type: refunds use spending categories, withdrawals savings ones. */
export function categoriesFor(type: string, available: Record<string, string[] | undefined>): string[] {
    const source = type === 'reimbursement' ? 'expense' : type === 'withdrawal' ? 'savings' : type
    return available[source] ?? []
}

export function groupUncategorized(
    transactions: { id: string; name?: string | null; note?: string | null; original_name?: string | null; amount: number | string; type: string; category_label?: string | null }[],
    available: Record<string, string[] | undefined>,
    guess: (name: unknown) => { type: string; category: string } | null,
): UncategorizedGroup[] {
    const groups = new Map<string, { names: Map<string, number>; type: string; ids: string[]; total: number; key: string }>()
    const wanted = transactions.filter(t => t.type !== 'transfer' && !(t.category_label ?? '').trim())
    // Grouped by the bank's wording, so renamed and not-yet-renamed ones stay together,
    // and spellings of the same place ("Aldi", "ALDI 60161") together too
    const rawKey = (t: (typeof transactions)[number]) => {
        const matchOn = String(t.original_name || String(t.name || t.note || '').trim())
        return merchantKey(matchOn) || matchOn.toLowerCase()
    }
    const place = placeGroups(wanted.map(rawKey))
    for (const t of wanted) {
        const label = String(t.name || t.note || '').trim()
        const key = place.get(rawKey(t)) ?? rawKey(t)
        const id = `${t.type}|${key}`
        const g = groups.get(id) ?? { names: new Map<string, number>(), type: t.type, ids: [] as string[], total: 0, key }
        g.names.set(label, (g.names.get(label) ?? 0) + 1)
        g.ids.push(t.id)
        g.total += Math.abs(Number(t.amount))
        groups.set(id, g)
    }

    return [...groups.values()].map(g => {
        const name = [...g.names.entries()].sort((a, b) => b[1] - a[1])[0][0]
        const choices = categoriesFor(g.type, available)
        const learned = guess(name)
        const spendingType = g.type === 'reimbursement' ? 'expense' : g.type
        let suggestion = learned && learned.type === spendingType ? learned.category : null
        if (!suggestion) suggestion = keywordCategory(name, choices)
        return { key: g.key, name, type: g.type, ids: g.ids, count: g.ids.length, total: Math.round(g.total * 100) / 100, suggestion }
    }).sort((a, b) => b.total - a.total)
}

export interface SplitGroup {
    key: string
    name: string
    ids: string[]
    count: number
    /** Every amount, purchases and paybacks alike: how much passed through this place */
    total: number
    /** Purchases minus paybacks: what this place really cost */
    spent: number
    /** Which of the new categories it most likely belongs in, or null if we can't tell */
    suggestion: string | null
}

/**
 * Everything in one spending category (purchases and paybacks), grouped by place, so the category
 * can be split into new ones a place at a time ("Giant x12 -> Groceries, Taco Bell x7 -> Eating out").
 */
export function groupForSplit(
    transactions: { id: string; name?: string | null; note?: string | null; original_name?: string | null; amount: number | string; type: string; category_label?: string | null }[],
    from: string,
    into: string[],
): SplitGroup[] {
    const wanted = from.trim().toLowerCase()
    const groups = new Map<string, { names: Map<string, number>; ids: string[]; total: number; spent: number; bank: string }>()
    const inCategory = transactions.filter(t => (t.type === 'expense' || t.type === 'reimbursement') && (t.category_label ?? '').trim().toLowerCase() === wanted)
    const bankOf = (t: (typeof transactions)[number]) => String(t.original_name || String(t.name || t.note || '').trim())
    const rawKey = (t: (typeof transactions)[number]) => merchantKey(bankOf(t)) || bankOf(t).toLowerCase()
    const place = placeGroups(inCategory.map(rawKey))
    for (const t of inCategory) {
        const label = String(t.name || t.note || '').trim()
        const bank = bankOf(t)
        const key = place.get(rawKey(t)) ?? rawKey(t)
        const g = groups.get(key) ?? { names: new Map<string, number>(), ids: [] as string[], total: 0, spent: 0, bank }
        g.names.set(label, (g.names.get(label) ?? 0) + 1)
        g.ids.push(t.id)
        const amount = Math.abs(Number(t.amount)) || 0
        g.total += amount
        g.spent += t.type === 'expense' ? amount : -amount
        groups.set(key, g)
    }
    const cents = (n: number) => Math.round(n * 100) / 100
    return [...groups.entries()].map(([key, g]) => {
        const name = [...g.names.entries()].sort((a, b) => b[1] - a[1])[0][0]
        const suggestion = keywordCategory(name, into) ?? keywordCategory(g.bank, into)
        return { key, name, ids: g.ids, count: g.ids.length, total: cents(g.total), spent: cents(g.spent), suggestion }
    }).sort((a, b) => b.total - a.total)
}
