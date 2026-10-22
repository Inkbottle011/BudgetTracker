import {
    jobMonthly, toMonthly, goalMonthly, buildPlan, planTotals, recentMonthlySpending, monthsUntil, emptyAnswers, startingAnswers,
    type PlanAnswers,
} from '../logic/planner'

const TODAY = '2026-10-22'

describe('jobMonthly (take-home per month)', () => {
    it('hourly: rate × hours a week × 52 weeks ÷ 12, less taxes', () => {
        expect(jobMonthly({ name: 'Cafe', payType: 'hourly', hourlyRate: '20', hoursPerWeek: '25', taxPercent: '10' })).toBe(1950)
        expect(jobMonthly({ name: 'Cafe', payType: 'hourly', hourlyRate: '$18.50', hoursPerWeek: '40', taxPercent: '' })).toBe(3206.67)
    })

    it('salary: per year ÷ 12, less taxes', () => {
        expect(jobMonthly({ name: 'Office', payType: 'salary', salary: '60,000', taxPercent: '25' })).toBe(3750)
    })

    it('per paycheck, by how often you\'re paid', () => {
        const job = (paycheckFrequency: any) => ({ name: 'Job', payType: 'paycheck' as const, paycheck: '1000', paycheckFrequency, taxPercent: '0' })
        expect(jobMonthly(job('weekly'))).toBe(4333.33)
        expect(jobMonthly(job('biweekly'))).toBe(2166.67)
        expect(jobMonthly(job('semimonthly'))).toBe(2000)
        expect(jobMonthly(job('monthly'))).toBe(1000)
    })

    it('is 0 until the numbers are filled in, and ignores silly tax rates', () => {
        expect(jobMonthly({ name: 'Job', payType: 'hourly', hourlyRate: '', hoursPerWeek: '20', taxPercent: '' })).toBe(0)
        expect(jobMonthly({ name: 'Job', payType: 'salary', salary: '12000', taxPercent: '150' })).toBe(1000)
    })
})

describe('toMonthly', () => {
    it('turns a weekly, monthly or yearly amount into a monthly one', () => {
        expect(toMonthly('60', 'week')).toBe(260)
        expect(toMonthly('$900', 'month')).toBe(900)
        expect(toMonthly('1,200', 'year')).toBe(100)
        expect(toMonthly('', 'month')).toBe(0)
    })
})

describe('saving goals', () => {
    it('counts the months until a goal date, at least one', () => {
        expect(monthsUntil('2027-10', TODAY)).toBe(12)
        expect(monthsUntil('2026-12', TODAY)).toBe(2)
        expect(monthsUntil('2026-10', TODAY)).toBe(1)
        expect(monthsUntil('2020-01', TODAY)).toBe(1)
    })

    it('a target by a date: what to put away each month, less what you already have', () => {
        expect(goalMonthly({ name: 'Emergency fund', kind: 'target', target: '3000', saved: '0', by: '2027-10' }, TODAY, 2000)).toBe(250)
        expect(goalMonthly({ name: 'Car', kind: 'target', target: '5000', saved: '2000', by: '2027-04' }, TODAY, 2000)).toBe(500)
        expect(goalMonthly({ name: 'Done', kind: 'target', target: '1000', saved: '1500', by: '2027-04' }, TODAY, 2000)).toBe(0)
    })

    it('a fixed amount a month, or a share of your income', () => {
        expect(goalMonthly({ name: 'Vacation', kind: 'monthly', monthly: '75' }, TODAY, 2000)).toBe(75)
        expect(goalMonthly({ name: 'Retirement', kind: 'percent', percent: '5' }, TODAY, 3206.67)).toBe(160.33)
    })
})

describe('recentMonthlySpending', () => {
    const t = (date: string, amount: number, category_label: string, type = 'expense') => ({ date, amount, category_label, type })
    it('averages the last three full months for a category, net of paybacks', () => {
        const list = [
            t('2026-07-05', 100, 'Food'), t('2026-08-05', 200, 'Food'), t('2026-09-05', 300, 'Food'),
            t('2026-09-20', 30, 'Food', 'reimbursement'),
            t('2026-10-05', 999, 'Food'),        // this month isn't over yet: left out
            t('2026-06-05', 999, 'Food'),        // older than three months: left out
            t('2026-09-05', 50, 'Fun'),
        ]
        expect(recentMonthlySpending(list, 'food', TODAY)).toBe(190)
        expect(recentMonthlySpending(list, 'Gym', TODAY)).toBe(0)
    })
})

describe('buildPlan', () => {
    const answers = (): PlanAnswers => ({
        ...emptyAnswers(),
        jobs: [{ name: 'Cafe', payType: 'hourly', hourlyRate: '20', hoursPerWeek: '25', taxPercent: '10' }],
        otherIncome: [{ name: 'Tutoring', amount: '200', period: 'month' }],
        costs: [
            { name: 'Rent', amount: '900', period: 'month' },
            { name: 'Groceries', amount: '60', period: 'week' },
            { name: 'Gym', amount: '', period: 'month' },               // left blank: not added
        ],
        goals: [{ name: 'Emergency fund', kind: 'target', target: '3000', saved: '', by: '2027-10' }],
        investing: [{ name: 'Index fund', amount: '50', period: 'month' }],
    })

    it('turns the answers into monthly budget items, leaving out blanks', () => {
        expect(buildPlan(answers(), TODAY)).toEqual([
            { name: 'Cafe', type: 'income', monthly: 1950 },
            { name: 'Tutoring', type: 'income', monthly: 200 },
            { name: 'Rent', type: 'expense', monthly: 900 },
            { name: 'Groceries', type: 'expense', monthly: 260 },
            { name: 'Emergency fund', type: 'savings', monthly: 250 },
            { name: 'Index fund', type: 'investment', monthly: 50 },
        ])
    })

    it('adds up items with the same name, and names unnamed jobs', () => {
        const a = { ...answers(), jobs: [{ name: '', payType: 'salary' as const, salary: '24000', taxPercent: '' }, { name: ' ', payType: 'salary' as const, salary: '12000', taxPercent: '' }],
            costs: [{ name: 'Rent', amount: '900', period: 'month' as const }, { name: 'rent', amount: '100', period: 'month' as const }] }
        const plan = buildPlan(a, TODAY)
        expect(plan.filter(p => p.type === 'income').map(p => p.name)).toEqual(['Job 1', 'Job 2', 'Tutoring'])
        expect(plan.find(p => p.name === 'Rent')!.monthly).toBe(1000)
    })

    it('totals it up: what comes in, goes out, gets saved, and what\'s left', () => {
        expect(planTotals(buildPlan(answers(), TODAY))).toEqual({ income: 2150, spending: 1160, saving: 250, investing: 50, left: 690 })
    })
})

describe('startingAnswers', () => {
    it('starts from what is already in your budget, at its monthly amount', () => {
        const a = startingAnswers([
            { name: 'Pay', type: 'income', monthly: 3000 },
            { name: 'Rent', type: 'expense', monthly: 900 },
            { name: 'Gym', type: 'expense', monthly: 0 },
            { name: 'Vacation', type: 'savings', monthly: 100 },
            { name: 'Index fund', type: 'investment', monthly: 50 },
        ])
        expect(a.jobs).toEqual([])
        expect(a.costs).toEqual([{ name: 'Rent', amount: '900', period: 'month' }, { name: 'Gym', amount: '', period: 'month' }])
        expect(a.goals.map(g => g.name)).toEqual(['Emergency fund', 'Vacation'])
        expect(a.goals[1]).toEqual({ name: 'Vacation', kind: 'monthly', monthly: '100' })
        expect(a.investing).toEqual([{ name: 'Index fund', amount: '50', period: 'month' }])
    })

    it('gives an empty budget a few common costs to fill in, and keeps an existing emergency fund', () => {
        expect(startingAnswers([]).costs.map(c => c.name)).toEqual(['Rent or mortgage', 'Utilities', 'Phone', 'Groceries', 'Gas and transport'])
        const a = startingAnswers([{ name: 'emergency fund', type: 'savings', monthly: 200 }])
        expect(a.goals).toEqual([{ name: 'emergency fund', kind: 'monthly', monthly: '200' }])
    })
})
