// Money moving between your own linked accounts (savings -> checking, one bank -> another, paying a
// card) shows up twice: leaving one account and arriving in another. Counted as spending AND income
// it inflates both, so pairs like these are saved as 'transfer', which never counts toward totals.

export interface TransferCandidate {
    key: string
    accountId: string
    accountType: string     // 'credit' for cards
    date: string
    amount: number          // always positive
    moneyIn: boolean
    description: string
}

/** How many days a transfer can take to arrive (between banks it's often 1-3 business days). */
export const TRANSFER_DAYS = 3

// Person-to-person apps: a $20 Zelle the same day as a $20 move between your accounts is usually a
// friend, not you, so these are never paired
const PERSON_TO_PERSON = /zelle|venmo|cash\s*app|square\s*cash|paypal/i

function daysApart(a: string, b: string) {
    return Math.abs(Date.parse(`${a.slice(0, 10)}T00:00:00Z`) - Date.parse(`${b.slice(0, 10)}T00:00:00Z`)) / 86_400_000
}

/** The keys of every transaction that's one side of a transfer. */
export function findTransfers(items: TransferCandidate[]): Set<string> {
    return new Set(findTransferPairs(items).flat())
}

/** [money out, money in] pairs. Each transaction is paired at most once, with the closest date. */
export function findTransferPairs(items: TransferCandidate[]): [string, string][] {
    const eligible = items.filter(t => !PERSON_TO_PERSON.test(t.description))
    // Money leaving a card is a purchase (or cash advance), never you moving your own money
    const byDate = (a: TransferCandidate, b: TransferCandidate) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key)
    const outs = eligible.filter(t => !t.moneyIn && t.accountType !== 'credit').sort(byDate)
    const ins = eligible.filter(t => t.moneyIn).sort(byDate)
    const paired = new Set<string>()
    const pairs: [string, string][] = []

    for (const out of outs) {
        let best: TransferCandidate | null = null
        for (const into of ins) {
            if (paired.has(into.key) || into.accountId === out.accountId) continue
            if (Math.abs(into.amount - out.amount) >= 0.005) continue
            const gap = daysApart(into.date, out.date)
            if (gap > TRANSFER_DAYS) continue
            if (!best || gap < daysApart(best.date, out.date)) best = into
        }
        if (best) {
            paired.add(out.key)
            paired.add(best.key)
            pairs.push([out.key, best.key])
        }
    }
    return pairs
}
