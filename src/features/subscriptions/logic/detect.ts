// Spotting subscriptions in your spending: the same place charging about the same amount on a regular
// schedule. Charges only; income is left out because pay isn't fixed. Plain functions, so they're easy to test.
import { merchantKey } from '../../../shared/money/entry'
import { occurrence, type Frequency, type Subscription } from './subscriptions'

interface Tx {
    date: string
    name?: string | null
    original_name?: string | null
    amount: number | string
    type: string
    category_label?: string | null
    subscription_id?: string | null
}

export interface RecurringSuggestion {
    key: string             // the place, as matched (also what's saved when you say it's not a subscription)
    name: string            // as shown in your transactions
    amount: number          // the newest charge
    frequency: Frequency
    category: string | null
    lastDate: string
    nextDate: string        // when the next charge is expected: always after today, so adding it never repeats one already imported
    count: number           // how many charges in a row fit the schedule
}

export interface PriceChange {
    subscription: Subscription
    amount: number          // what the bank charged most recently
    date: string
}

// Days between charges that fit each schedule (charges move a little for weekends and short months)
const GAPS: Record<Frequency, [number, number]> = { weekly: [5, 9], biweekly: [12, 16], monthly: [26, 35], yearly: [350, 380] }
const PERIOD_DAYS: Record<Frequency, number> = { weekly: 7, biweekly: 14, monthly: 31, yearly: 366 }
const MIN_CHARGES: Record<Frequency, number> = { weekly: 3, biweekly: 3, monthly: 3, yearly: 2 }
const PRICE_WIGGLE = 0.25   // charges in a row may differ from the newest by up to 25% (small price changes)

/** The place behind a transaction name, ignoring the codes banks add to each charge. */
export function recurringKey(name: unknown): string {
    return merchantKey(name).split(' ').filter(w => w.length > 1).slice(0, 2).join(' ')
}

/**
 * The same brand, allowing for the bank's extra words: "claude" matches the bank's "anthropic claude"
 * (the brand appears in the other name), but "apple cloud" doesn't match "google cloud" (only a shared word).
 */
function sharesWord(a: string, b: string) {
    if (!a || !b) return false
    const aw = a.split(' '), bw = b.split(' ')
    return bw.includes(aw[0]) || aw.includes(bw[0])
}

const dayNumber = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86_400_000
const daysBetween = (a: string, b: string) => dayNumber(b) - dayNumber(a)
const keysOf = (t: Tx) => [recurringKey(t.original_name), recurringKey(t.name)].filter(Boolean)
const isBankCharge = (t: Tx) => t.type === 'expense' && !t.subscription_id

/**
 * Charges that look like subscriptions you haven't added yet, soonest next charge first.
 * `dismissed` are places you said aren't subscriptions.
 */
export function findRecurringCharges(transactions: Tx[], subscriptions: Subscription[], dismissed: string[], today: string): RecurringSuggestion[] {
    const yours = subscriptions.map(s => recurringKey(s.name))
    const groups = new Map<string, Tx[]>()
    for (const t of transactions) {
        if (!isBankCharge(t)) continue
        const key = recurringKey(t.original_name || t.name)
        if (!key) continue
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key)!.push(t)
    }

    const found: RecurringSuggestion[] = []
    for (const [key, list] of groups) {
        if (dismissed.includes(key)) continue
        // One charge per day, oldest first
        const byDate = new Map<string, Tx>()
        for (const t of list) if (!byDate.has(t.date.slice(0, 10))) byDate.set(t.date.slice(0, 10), t)
        const charges = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, t]) => t)
        const latest = charges.at(-1)!
        if (charges.some(t => keysOf(t).some(k => yours.some(y => sharesWord(k, y))))) continue

        const best = bestSchedule(charges)
        if (!best) continue
        const lastDate = latest.date.slice(0, 10)
        if (daysBetween(lastDate, today) > PERIOD_DAYS[best.frequency] * 1.5) continue   // seems to have stopped

        found.push({
            key, name: String(latest.name || latest.original_name || key), amount: Number(latest.amount),
            frequency: best.frequency, category: mostCommon(best.run.map(t => t.category_label)),
            lastDate, nextDate: nextAfter(lastDate, best.frequency, today), count: best.run.length,
        })
    }
    return found.sort((a, b) => a.nextDate.localeCompare(b.nextDate) || a.name.localeCompare(b.name))
}

/** The schedule that fits the most recent charges in a row, with amounts close to the newest. */
function bestSchedule(charges: Tx[]): { frequency: Frequency; run: Tx[] } | null {
    let best: { frequency: Frequency; run: Tx[] } | null = null
    const newest = Number(charges.at(-1)!.amount)
    for (const frequency of Object.keys(GAPS) as Frequency[]) {
        const [min, max] = GAPS[frequency]
        const run = [charges.at(-1)!]
        let missed = false   // monthly only: one missing month is fine (paid another way); two isn't a schedule
        for (let i = charges.length - 2; i >= 0; i--) {
            const gap = daysBetween(charges[i].date.slice(0, 10), run[0].date.slice(0, 10))
            const amount = Number(charges[i].amount)
            if (Math.abs(amount - newest) > newest * PRICE_WIGGLE) break
            const fits = gap >= min && gap <= max
            const skipsOne = frequency === 'monthly' && !missed && gap >= 2 * min && gap <= 2 * max
            if (!fits && !skipsOne) break
            if (skipsOne && !fits) missed = true
            run.unshift(charges[i])
        }
        if (run.length >= MIN_CHARGES[frequency] && (!best || run.length > best.run.length)) best = { frequency, run }
    }
    return best
}

/** The first charge on the schedule that's after today (one due today may already be in). */
function nextAfter(last: string, frequency: Frequency, today: string) {
    let n = 1
    while (occurrence(last, frequency, n) <= today) n++
    return occurrence(last, frequency, n)
}

function mostCommon(values: (string | null | undefined)[]): string | null {
    const counts = new Map<string, number>()
    for (const v of values) if (v && v.trim()) counts.set(v, (counts.get(v) ?? 0) + 1)
    let top: string | null = null
    for (const [v, c] of counts) if (!top || c > counts.get(top)!) top = v
    return top
}

/**
 * Active subscriptions whose latest charge from the bank doesn't match the amount saved for them,
 * like a streaming service raising its price.
 */
export function findPriceChanges(subscriptions: Subscription[], transactions: Tx[], today: string): PriceChange[] {
    const changes: PriceChange[] = []
    for (const s of subscriptions) {
        if (s.status !== 'active' || s.type !== 'expense') continue
        const key = recurringKey(s.name)
        const recent = transactions
            .filter(t => isBankCharge(t) && daysBetween(t.date.slice(0, 10), today) <= PERIOD_DAYS[s.frequency] + 10)
            .filter(t => keysOf(t).some(k => sharesWord(k, key)))
            // a loose name match, so only charges near the saved price (not other shopping at the same company)
            .filter(t => Math.abs(Number(t.amount) - Number(s.amount)) <= Number(s.amount) * 0.5)
            .sort((a, b) => a.date.localeCompare(b.date))
        const latest = recent.at(-1)
        if (latest && Math.abs(Number(latest.amount) - Number(s.amount)) >= 0.01) {
            changes.push({ subscription: s, amount: Number(latest.amount), date: latest.date.slice(0, 10) })
        }
    }
    return changes
}
