import { useState, useCallback } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { supabase } from '../../../shared/supabase'
import { useTransactionStore, loadAllTransactions } from '../../transactions/api'
import { loadBudgetItems, loadBudgetAmounts } from '../../budget/api'
import { BankAccountRow, loadAccountBalances, loadPendingCharges, PendingCharge } from '../../bank/api'
import { todayString } from '../../../shared/money/entry'
import { Subscription, fetchSubscriptions, upcomingCharges, fetchDismissed, findRecurringCharges } from '../../subscriptions/api'
import { attributeReimbursements } from './calculations'
import {
    Period, periodRange, shiftAnchor, periodTitle, periodElapsed, daysLeftAfterToday,
    periodSummary, budgetRows, goalRows, accountsSummary, inRange,
} from './summary'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function useDashboardLogic() {
    const { transactions, setTransactions } = useTransactionStore()
    const [budgetItems, setBudgetItems] = useState<any[]>([])
    const [budgetAmounts, setBudgetAmounts] = useState<any[]>([])
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
    const [accounts, setAccounts] = useState<BankAccountRow[]>([])
    const [dismissed, setDismissed] = useState<string[]>([])
    const [pending, setPending] = useState<PendingCharge[]>([])

    const today = todayString()
    const [view, setView] = useState<Period>('month')
    const [anchor, setAnchor] = useState(today)

    // Refresh whenever the tab is opened, so changes made on other tabs show up
    useFocusEffect(useCallback(() => { fetchAll() }, []))

    async function fetchAll() {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const txData = await loadAllTransactions()
        if (txData) setTransactions(txData)

        fetchSubscriptions().then(setSubscriptions).catch(() => {})
        fetchDismissed().then(setDismissed).catch(() => {})
        loadPendingCharges().then(setPending).catch(() => {})

        const items = await loadBudgetItems()
        if (items) setBudgetItems(items)

        // Every year's plan, so a week spanning New Year still has one
        const amounts = await loadBudgetAmounts()
        if (amounts) setBudgetAmounts(amounts)

        // Linked bank balances (none until a bank is linked)
        setAccounts(await loadAccountBalances())
    }

    // Paybacks count in the period of the expense they pay back
    const forTotals = attributeReimbursements(transactions)

    const range = periodRange(view, anchor)
    const title = periodTitle(view, range, today)
    const isCurrent = today >= range.start && today < range.end
    const summary = periodSummary(forTotals, range)
    const budget = budgetRows(budgetItems, budgetAmounts, forTotals, range)
    const goals = goalRows(budgetItems, budgetAmounts, forTotals, range)

    const monthName = MONTH_NAMES[+range.start.slice(5, 7) - 1]
    const heading = view === 'day' ? (title === 'Today' ? 'Spent today' : `Spent on ${title}`)
        : view === 'week' ? (isCurrent ? 'Spent this week' : `Spent ${title}`)
        : view === 'month' ? `Spent in ${monthName}` : `Spent in ${range.start.slice(0, 4)}`
    const budgetTitle = view === 'day' ? (title === 'Today' ? 'Budget for today' : `Budget for ${title}`)
        : view === 'week' ? (isCurrent ? 'Budget this week' : `Budget for ${title}`)
        : view === 'month' ? `Budget for ${monthName}` : `Budget for ${range.start.slice(0, 4)}`

    const upcoming = upcomingCharges(subscriptions, 30).slice(0, 6).map(c => ({
        id: c.id, name: c.name, date: c.nextDate, type: c.type, amount: c.amount, sub: c.recurring,
    }))
    // Charges the bank hasn't posted yet: listed first, marked pending, and not in the totals
    const recent = [
        ...pending.map(p => ({ id: `pending-${p.id}`, name: p.name, date: p.date, type: p.money_in ? 'income' : 'expense', amount: p.amount, sub: 'Pending' })),
        ...transactions,
    ].slice(0, 8)
    const pendingSpent = Math.round(pending.filter(p => !p.money_in && inRange(p.date, range)).reduce((s, p) => s + p.amount, 0) * 100) / 100
    // Repeating charges you haven't added as subscriptions yet (reviewed on the Subscriptions tab)
    const possibleSubscriptions = findRecurringCharges(transactions as any[], subscriptions, dismissed, today).length

    const bank = accountsSummary(accounts)
    const updatedAt = accounts.map(a => a.balance_updated_at).filter(Boolean).sort().at(-1) ?? null

    return {
        transactions, forTotals, view, title, heading, budgetTitle, isCurrent,
        anchor, selectedYear: +range.start.slice(0, 4),
        setView: (v: Period) => setView(v),
        prev: () => setAnchor(a => shiftAnchor(view, a, -1)),
        next: () => setAnchor(a => shiftAnchor(view, a, 1)),
        goToday: () => setAnchor(today),
        summary, plannedTotal: budget.totalPlanned,
        elapsed: periodElapsed(range, today), daysLeft: daysLeftAfterToday(range, today),
        budget, goals, upcoming, recent, bank, updatedAt, possibleSubscriptions, pendingSpent,
    }
}
