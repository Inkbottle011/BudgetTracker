// What a new person has set up so far, read from the other features' own data.
import { latestTransactionDate } from '../../transactions/api'
import { loadBudgetItems } from '../../budget/api'
import { fetchSubscriptions } from '../../subscriptions/api'
import { twoFactorStatus } from '../../account/api'

export interface Progress {
    transactions: boolean
    budget: boolean
    subscriptions: boolean
    twoFactor: boolean
}

export type StepId = keyof Progress

/** The getting-started steps, in the order they're shown. */
export const STEP_ORDER: StepId[] = ['transactions', 'budget', 'subscriptions', 'twoFactor']

/** What's set up, or null if the database didn't answer (so nothing is shown wrongly). */
export async function loadProgress(): Promise<Progress | null> {
    try {
        const [tx, items, subs, twoFactor] = await Promise.all([
            latestTransactionDate(),
            loadBudgetItems(),
            fetchSubscriptions(),
            twoFactorStatus().then(s => s.on).catch(() => false),
        ])
        if (items === null) return null
        return { transactions: tx.length > 0, budget: items.length > 0, subscriptions: subs.length > 0, twoFactor }
    } catch {
        return null
    }
}

export function stepsFrom(p: Progress): { id: StepId; done: boolean }[] {
    return STEP_ORDER.map(id => ({ id, done: p[id] }))
}

/** Nothing added yet. Two-factor alone doesn't count: it's not something you'd have set up to use the app. */
export function isBrandNew(p: Progress): boolean {
    return !p.transactions && !p.budget && !p.subscriptions
}
