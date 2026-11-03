// What each getting-started step says, and where its buttons take you.
import { openImportOnArrival, useTransactionFilters } from '../../transactions/api'
import { openPlanGuideOnArrival } from '../../budget/api'
import { StepId } from './progress'

/** The tabs a step can send you to. */
export type Tab = 'Dashboard' | 'Transactions' | 'Budget' | 'Subscriptions' | 'Settings'

export interface StepAction { label: string; tab: Tab; before?: () => void }

/** Shows the whole list, so a transaction you add or import isn't hidden by an old filter. */
const wholeList = () => useTransactionFilters.getState().clear()

export const linkBank: StepAction = { label: 'Link a bank', tab: 'Settings' }
export const importFile: StepAction = { label: 'Import a file', tab: 'Transactions', before: () => { wholeList(); openImportOnArrival() } }
export const addOne: StepAction = { label: 'Add one', tab: 'Transactions', before: wholeList }

export const STEPS: Record<StepId, { title: string; help: string; actions: StepAction[] }> = {
    transactions: {
        title: 'Add your transactions',
        help: 'Link your bank so they come in by themselves, bring in a file from your bank, or type them in.',
        actions: [linkBank, importFile, addOne],
    },
    budget: {
        title: 'Plan your budget',
        help: 'Answer a few questions and it works out how much to plan for each category.',
        actions: [{ label: 'Plan my budget', tab: 'Budget', before: openPlanGuideOnArrival }],
    },
    subscriptions: {
        title: 'Add your subscriptions',
        help: "Rent, phone, streaming: anything that repeats. They're added to your transactions on their dates.",
        actions: [{ label: 'Add subscriptions', tab: 'Subscriptions' }],
    },
    twoFactor: {
        title: 'Turn on two-factor sign-in',
        help: 'Keeps your account safe with a code from your phone. You need it to link a bank.',
        actions: [{ label: 'Turn it on', tab: 'Settings' }],
    },
}

/** Does what the button asks first (like opening the import window), then goes to its tab. */
export function go(action: StepAction, onGo: (tab: Tab) => void) {
    action.before?.()
    onGo(action.tab)
}
