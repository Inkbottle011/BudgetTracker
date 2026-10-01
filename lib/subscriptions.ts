import { supabase } from './supabase'

export type Frequency = 'weekly' | 'biweekly' | 'monthly' | 'yearly'
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled'

export interface Subscription {
    id: string
    user_id: string
    name: string
    amount: number
    type: 'income' | 'expense' | 'savings' | 'investment'
    category_label: string | null
    note: string | null
    frequency: Frequency
    start_date: string
    end_date: string | null
    status: SubscriptionStatus
    generated_through: string | null
    created_at: string
}

export const FREQUENCIES: Frequency[] = ['weekly', 'biweekly', 'monthly', 'yearly']

export const FREQUENCY_LABELS: Record<Frequency, string> = {
    weekly: 'Weekly',
    biweekly: 'Every 2 weeks',
    monthly: 'Monthly',
    yearly: 'Yearly',
}

export const FREQUENCY_SHORT: Record<Frequency, string> = {
    weekly: 'week',
    biweekly: '2 weeks',
    monthly: 'month',
    yearly: 'year',
}

// How many times per month a charge happens on average
const PER_MONTH: Record<Frequency, number> = {
    weekly: 52 / 12,
    biweekly: 26 / 12,
    monthly: 1,
    yearly: 1 / 12,
}

// ---- Dates as plain 'YYYY-MM-DD' strings, so time zones can't shift them ----

function pad(n: number) { return String(n).padStart(2, '0') }

export function toDateString(d: Date): string {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Today's date where the user is (not UTC). */
export function localToday(): string {
    return toDateString(new Date())
}

export function addDays(date: string, days: number): string {
    const [y, m, d] = date.split('-').map(Number)
    return toDateString(new Date(y, m - 1, d + days))
}

function daysInMonth(year: number, month0: number) {
    return new Date(year, month0 + 1, 0).getDate()
}

/**
 * Date of the n-th charge (n = 0 is the start date). Matches the database's
 * subscription_occurrence(): always counted from the start date, and a monthly
 * charge on the 31st uses the last day of shorter months without drifting.
 */
export function occurrence(start: string, frequency: Frequency, n: number): string {
    const [y, m, d] = start.split('-').map(Number)
    if (frequency === 'weekly') return addDays(start, 7 * n)
    if (frequency === 'biweekly') return addDays(start, 14 * n)
    const totalMonths = (m - 1) + (frequency === 'monthly' ? n : 12 * n)
    const year = y + Math.floor(totalMonths / 12)
    const month0 = totalMonths % 12
    return toDateString(new Date(year, month0, Math.min(d, daysInMonth(year, month0))))
}

export function isValidDate(s: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
    const [y, m, d] = s.split('-').map(Number)
    return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m - 1)
}

/** True once a subscription has passed its end date. */
export function hasEnded(sub: Subscription, today = localToday()): boolean {
    return sub.status === 'cancelled' || (!!sub.end_date && sub.end_date < today)
}

/** All charge dates from `from` to `to` (inclusive) that haven't been added yet. */
export function chargesBetween(sub: Subscription, from: string, to: string): string[] {
    if (sub.status !== 'active') return []
    const dates: string[] = []
    for (let n = 0; n < 5000; n++) {
        const d = occurrence(sub.start_date, sub.frequency, n)
        if (d > to || (sub.end_date && d > sub.end_date)) break
        if (d < from) continue
        if (sub.generated_through && d <= sub.generated_through) continue
        dates.push(d)
    }
    return dates
}

/** The next charge that hasn't been added yet, or null if there isn't one. */
export function nextCharge(sub: Subscription): string | null {
    if (sub.status !== 'active') return null
    for (let n = 0; n < 5000; n++) {
        const d = occurrence(sub.start_date, sub.frequency, n)
        if (sub.end_date && d > sub.end_date) return null
        if (!sub.generated_through || d > sub.generated_through) return d
    }
    return null
}

export function monthlyAmount(sub: Subscription): number {
    return Number(sub.amount) * PER_MONTH[sub.frequency]
}

export function formatDate(date: string): string {
    const [y, m, d] = date.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Upcoming charges in the next `days` days, across all subscriptions, soonest first. */
export function upcomingCharges(subs: Subscription[], days = 30) {
    const today = localToday()
    const until = addDays(today, days)
    return subs
        .flatMap(s => chargesBetween(s, today, until).map(date => ({
            id: s.id,
            name: s.name,
            category_label: s.category_label,
            type: s.type,
            amount: Number(s.amount),
            nextDate: date,
            recurring: FREQUENCY_LABELS[s.frequency],
        })))
        .sort((a, b) => a.nextDate.localeCompare(b.nextDate))
}

// ---- Talking to the database ----

export async function fetchSubscriptions(): Promise<Subscription[]> {
    const { data, error } = await supabase.from('subscriptions').select('*').order('name')
    if (error) throw error
    return (data ?? []) as Subscription[]
}

/**
 * Adds every charge that's due and missing, once, on its real date.
 * Safe to call any time: the database refuses duplicates.
 * Returns how many charges were added (0 if it couldn't run).
 */
export async function syncSubscriptionCharges(): Promise<number> {
    const { data, error } = await supabase.rpc('generate_subscription_transactions', { p_today: localToday() })
    if (error) {
        console.warn('Could not add subscription charges:', error.message)
        return 0
    }
    return typeof data === 'number' ? data : 0
}
