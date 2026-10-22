// The questions behind "Plan with questions": turning answers like "$20 an hour, 25 hours a week" into
// monthly budget amounts. Plain functions, so the maths is easy to test. Amounts are typed text, as in the form.
import { parseAmount } from '../../../shared/money/entry'
import type { BudgetType } from './types'

export type PayType = 'hourly' | 'salary' | 'paycheck'
export type PayFrequency = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly'
export type Period = 'week' | 'month' | 'year'

export interface Job {
    name: string
    payType: PayType
    hourlyRate?: string
    hoursPerWeek?: string
    salary?: string               // per year
    paycheck?: string
    paycheckFrequency?: PayFrequency
    taxPercent: string            // taken out for taxes and deductions; blank or 0 if the amounts are take-home
}

/** Something with an amount per week, month or year: other income, a cost, investing. */
export interface Amount { name: string; amount: string; period: Period }

export interface SavingGoal {
    name: string
    kind: 'target' | 'monthly' | 'percent'
    target?: string               // 'target': how much you want
    saved?: string                //   ...how much you have already
    by?: string                   //   ...by when, 'YYYY-MM'
    monthly?: string              // 'monthly': a fixed amount each month
    percent?: string              // 'percent': a share of your take-home income
}

export interface PlanAnswers {
    jobs: Job[]
    otherIncome: Amount[]
    costs: Amount[]
    goals: SavingGoal[]
    investing: Amount[]
}

export interface PlanItem { name: string; type: BudgetType; monthly: number }

export const PAYCHECKS_PER_MONTH: Record<PayFrequency, number> = { weekly: 52 / 12, biweekly: 26 / 12, semimonthly: 2, monthly: 1 }
const PER_MONTH: Record<Period, number> = { week: 52 / 12, month: 1, year: 1 / 12 }

const cents = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const num = (s: string | undefined) => {
    const n = parseAmount(s ?? '')
    return n === null || !isFinite(n) ? 0 : Math.abs(n)
}

export function emptyAnswers(): PlanAnswers {
    return { jobs: [], otherIncome: [], costs: [], goals: [], investing: [] }
}

/** A job's take-home pay per month. */
export function jobMonthly(job: Job): number {
    let gross = 0
    if (job.payType === 'hourly') gross = num(job.hourlyRate) * num(job.hoursPerWeek) * 52 / 12
    else if (job.payType === 'salary') gross = num(job.salary) / 12
    else gross = num(job.paycheck) * PAYCHECKS_PER_MONTH[job.paycheckFrequency ?? 'biweekly']
    const tax = num(job.taxPercent)
    const kept = tax > 0 && tax < 90 ? 1 - tax / 100 : 1
    return cents(gross * kept)
}

export function toMonthly(amount: string, period: Period): number {
    return cents(num(amount) * PER_MONTH[period])
}

/** Months from this month until a 'YYYY-MM' month: at least 1. */
export function monthsUntil(by: string, today: string): number {
    const [y, m] = by.split('-').map(Number)
    if (!y || !m) return 1
    const diff = (y * 12 + m) - (+today.slice(0, 4) * 12 + +today.slice(5, 7))
    return Math.max(1, diff)
}

/** What to put toward a goal each month. `income` is your monthly take-home, for goals set as a percentage. */
export function goalMonthly(goal: SavingGoal, today: string, income: number): number {
    if (goal.kind === 'monthly') return cents(num(goal.monthly))
    if (goal.kind === 'percent') return cents(income * Math.min(num(goal.percent), 100) / 100)
    const left = Math.max(0, num(goal.target) - num(goal.saved))
    return cents(left / monthsUntil(goal.by ?? '', today))
}

/** Average spent per month on a category over the last three full months (paybacks taken off). */
export function recentMonthlySpending(transactions: { date: string; amount: number | string; type: string; category_label?: string | null }[], category: string, today: string): number {
    const thisMonth = today.slice(0, 7)
    const [y, m] = thisMonth.split('-').map(Number)
    const start = new Date(Date.UTC(y, m - 1 - 3, 1)).toISOString().slice(0, 7)
    const name = category.trim().toLowerCase()
    let total = 0
    for (const t of transactions) {
        const month = String(t.date).slice(0, 7)
        if (month < start || month >= thisMonth || (t.category_label ?? '').trim().toLowerCase() !== name) continue
        if (t.type === 'expense') total += Number(t.amount)
        else if (t.type === 'reimbursement') total -= Number(t.amount)
    }
    return cents(Math.max(0, total) / 3)
}

/** Every answer as a monthly budget item. Blanks are left out; items with the same name are added together. */
export function buildPlan(a: PlanAnswers, today: string): PlanItem[] {
    const items: PlanItem[] = []
    const add = (name: string, type: BudgetType, monthly: number) => {
        const clean = name.trim()
        if (!clean || !(monthly > 0)) return
        const same = items.find(i => i.type === type && i.name.toLowerCase() === clean.toLowerCase())
        if (same) same.monthly = cents(same.monthly + monthly)
        else items.push({ name: clean, type, monthly: cents(monthly) })
    }
    a.jobs.forEach((j, i) => add(j.name.trim() || `Job ${i + 1}`, 'income', jobMonthly(j)))
    a.otherIncome.forEach(o => add(o.name, 'income', toMonthly(o.amount, o.period)))
    const income = items.reduce((s, i) => s + i.monthly, 0)
    a.costs.forEach(c => add(c.name, 'expense', toMonthly(c.amount, c.period)))
    a.goals.forEach(g => add(g.name, 'savings', goalMonthly(g, today, income)))
    a.investing.forEach(v => add(v.name, 'investment', toMonthly(v.amount, v.period)))
    return items
}

export function planTotals(items: PlanItem[]) {
    const sum = (type: BudgetType) => cents(items.filter(i => i.type === type).reduce((s, i) => s + i.monthly, 0))
    const income = sum('income'), spending = sum('expense'), saving = sum('savings'), investing = sum('investment')
    return { income, spending, saving, investing, left: cents(income - spending - saving - investing) }
}

/** Costs most people have, offered as one-tap rows in the guide. */
export const COMMON_COSTS = [
    'Rent or mortgage', 'Utilities', 'Phone', 'Internet', 'Groceries', 'Eating out', 'Gas and transport',
    'Car payment', 'Insurance', 'Subscriptions', 'Entertainment', 'Shopping', 'Health', 'Debt payments',
]
/** What someone with an empty budget starts with. */
export const STARTER_COSTS = ['Rent or mortgage', 'Utilities', 'Phone', 'Groceries', 'Gas and transport']
export const EMERGENCY_FUND = 'Emergency fund'

const asText = (n: number) => (n > 0 ? String(cents(n)) : '')
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * Where the guide starts: what's already in your budget (at its current monthly amount), plus a few
 * starter rows if you have no costs yet and an emergency fund goal if you don't have one.
 * Income isn't prefilled: the guide asks about jobs instead (your existing names are offered).
 */
export function startingAnswers(existing: { name: string; type: BudgetType; monthly: number }[]): PlanAnswers {
    const a = emptyAnswers()
    for (const e of existing) {
        if (e.type === 'expense') a.costs.push({ name: e.name, amount: asText(e.monthly), period: 'month' })
        else if (e.type === 'savings') a.goals.push({ name: e.name, kind: 'monthly', monthly: asText(e.monthly) })
        else if (e.type === 'investment') a.investing.push({ name: e.name, amount: asText(e.monthly), period: 'month' })
    }
    if (!a.costs.length) a.costs = STARTER_COSTS.map(name => ({ name, amount: '', period: 'month' as Period }))
    if (!a.goals.some(g => same(g.name, EMERGENCY_FUND))) a.goals.unshift({ name: EMERGENCY_FUND, kind: 'target', target: '', saved: '', by: '' })
    return a
}
