import {
    dateParts, inPeriod, sumByType, overview, plannedAmount, actualAmount, spendingByCategory, periodLabel,
} from '../calculations'

const tx = (date: string, type: string, amount: number | string, category_label = '') =>
    ({ id: `${date}-${type}-${amount}`, date, type, amount, category_label }) as any

describe('dateParts', () => {
    it('reads the calendar date as written, in any time zone', () => {
        // Tests run in New York time, where new Date('2026-10-01') is Sept 30 at 8pm
        expect(dateParts('2026-10-01')).toEqual({ year: 2026, month: 10, day: 1 })
        expect(dateParts('2026-01-01')).toEqual({ year: 2026, month: 1, day: 1 })
        expect(dateParts('2026-10-01T23:00:00Z')).toEqual({ year: 2026, month: 10, day: 1 })
    })
})

describe('inPeriod', () => {
    it('counts the first of the month in that month', () => {
        expect(inPeriod(tx('2026-10-01', 'expense', 1), 'month', 2026, 10)).toBe(true)
        expect(inPeriod(tx('2026-10-01', 'expense', 1), 'month', 2026, 9)).toBe(false)
    })
    it('counts New Year\'s Day in the new year', () => {
        expect(inPeriod(tx('2026-01-01', 'expense', 1), 'year', 2026, 1)).toBe(true)
        expect(inPeriod(tx('2026-01-01', 'expense', 1), 'year', 2025, 1)).toBe(false)
    })
    it('counts the last day of the month in that month', () => {
        expect(inPeriod(tx('2026-10-31', 'expense', 1), 'month', 2026, 10)).toBe(true)
    })
})

describe('sumByType', () => {
    it('adds amounts of one type, including amounts stored as text', () => {
        const list = [tx('2026-10-01', 'expense', 10), tx('2026-10-02', 'expense', '2.50'), tx('2026-10-03', 'income', 100)]
        expect(sumByType(list, 'expense')).toBe(12.5)
        expect(sumByType(list, 'income')).toBe(100)
        expect(sumByType(list, 'savings')).toBe(0)
    })
})

describe('overview', () => {
    const list = [
        tx('2025-12-31', 'income', 1000),
        tx('2026-01-01', 'income', 500),
        tx('2026-01-02', 'expense', 200),
        tx('2026-02-01', 'savings', 50),
        tx('2026-03-01', 'investment', 25),
    ]
    it('totals the given year, including Jan 1', () => {
        expect(overview(list, 2026)).toMatchObject({ income: 500, expenses: 200, savings: 50 })
    })
    it('balance is all-time income minus expenses', () => {
        expect(overview(list, 2026).balance).toBe(1300)
    })
})

describe('plannedAmount', () => {
    const amounts = [
        { budget_item_id: 'rent', month: 1, amount: 1000 },
        { budget_item_id: 'rent', month: 2, amount: 1000 },
        { budget_item_id: 'rent', month: 3, amount: '1100' },
        { budget_item_id: 'food', month: 1, amount: 300 },
    ] as any[]
    it('is the month\'s amount in month view', () => {
        expect(plannedAmount(amounts, 'rent', 'month', 3)).toBe(1100)
        expect(plannedAmount(amounts, 'rent', 'month', 4)).toBe(0)
    })
    it('is the year total in year view', () => {
        expect(plannedAmount(amounts, 'rent', 'year', 1)).toBe(3100)
    })
})

describe('actualAmount', () => {
    it('sums transactions with the item\'s name and type', () => {
        const list = [
            tx('2026-10-01', 'expense', 900, 'Rent'),
            tx('2026-10-02', 'expense', 100, 'Rent'),
            tx('2026-10-03', 'income', 50, 'Rent'),
            tx('2026-10-04', 'expense', 7, 'Food'),
        ]
        expect(actualAmount(list, 'Rent', 'expense')).toBe(1000)
    })
})

describe('spendingByCategory', () => {
    it('groups expenses by category, biggest first, with blanks as Other', () => {
        const list = [
            tx('2026-10-01', 'expense', 20, 'Food'),
            tx('2026-10-02', 'expense', '30', 'Food'),
            tx('2026-10-03', 'expense', 100, 'Rent'),
            tx('2026-10-04', 'expense', 5, ''),
            tx('2026-10-05', 'income', 999, 'Food'),
        ]
        expect(spendingByCategory(list)).toEqual([
            { label: 'Rent', amount: 100 }, { label: 'Food', amount: 50 }, { label: 'Other', amount: 5 },
        ])
    })
})

describe('periodLabel', () => {
    it('names the period', () => {
        expect(periodLabel('year', 2026, 10)).toBe('2026')
        expect(periodLabel('month', 2026, 10)).toBe('Oct 2026')
    })
})

import { monthlyTrend, trendMonths, budgetHealth } from '../calculations'

describe('trendMonths', () => {
    it('lists the last 6 months ending this month, across a year boundary', () => {
        expect(trendMonths(new Date(2026, 1, 15), false, 2026).map(m => `${m.label} ${m.year}`))
            .toEqual(['Sep 2025', 'Oct 2025', 'Nov 2025', 'Dec 2025', 'Jan 2026', 'Feb 2026'])
    })
    it('lists all 12 months of the selected year', () => {
        const months = trendMonths(new Date(2026, 9, 5), true, 2025)
        expect(months).toHaveLength(12)
        expect(months[0]).toEqual({ month: 1, year: 2025, label: 'Jan' })
    })
})

describe('monthlyTrend', () => {
    it('totals income and expenses per month, counting the 1st in its own month', () => {
        const list = [
            tx('2026-09-30', 'expense', 10),
            tx('2026-10-01', 'income', 100),
            tx('2026-10-01', 'expense', '25'),
            tx('2026-10-31', 'savings', 50),
        ]
        expect(monthlyTrend(list, [{ month: 9, year: 2026, label: 'Sep' }, { month: 10, year: 2026, label: 'Oct' }])).toEqual([
            { label: 'Sep', income: 0, expense: 10, net: -10 },
            { label: 'Oct', income: 100, expense: 25, net: 75 },
        ])
    })
})

describe('budgetHealth', () => {
    const items = [{ id: 'rent', name: 'Rent', type: 'expense' }, { id: 'food', name: 'Food', type: 'expense' }, { id: 'pay', name: 'Pay', type: 'income' }]
    const amounts = [
        { budget_item_id: 'rent', month: 1, amount: 1000 },
        { budget_item_id: 'food', month: 1, amount: '200' },
        { budget_item_id: 'pay', month: 1, amount: 5000 },
    ]

    it('scores 100 when on or under budget', () => {
        const r = budgetHealth(items, amounts, [tx('2026-01-01', 'expense', 1000, 'Rent')], 2026)
        expect(r).toMatchObject({ score: 100, planned: 1200, actual: 1000, overBudgetCount: 0 })
    })

    it('loses points for the share spent over budget, and counts items over', () => {
        const r = budgetHealth(items, amounts, [tx('2026-01-01', 'expense', 1000, 'Rent'), tx('2026-01-05', 'expense', 440, 'Food')], 2026)
        expect(r).toMatchObject({ score: 80, actual: 1440, overBudgetCount: 1 })
    })

    it('only counts spending in the given year, including Jan 1', () => {
        const r = budgetHealth(items, amounts, [tx('2025-12-31', 'expense', 5000, 'Rent'), tx('2026-01-01', 'expense', 10, 'Rent')], 2026)
        expect(r.actual).toBe(10)
    })

    it('has no score without a budget', () => {
        expect(budgetHealth([], [], [], 2026).score).toBeNull()
    })

    it('never goes below 0', () => {
        expect(budgetHealth(items, amounts, [tx('2026-01-01', 'expense', 99999, 'Rent')], 2026).score).toBe(0)
    })
})

import { attributeReimbursements, netSpent } from '../calculations'

describe('reimbursements', () => {
    // $120 dinner on Sept 30, friends pay back $90 in October
    const dinner = { ...tx('2026-09-30', 'expense', 120, 'Food'), id: 'dinner' }
    const sam = { ...tx('2026-10-02', 'reimbursement', 30, 'Food'), id: 'sam', reimburses_id: 'dinner' }
    const alex = { ...tx('2026-10-03', 'reimbursement', '60', 'Food'), id: 'alex', reimburses_id: 'dinner' }
    const refund = { ...tx('2026-10-10', 'reimbursement', 15, 'Shopping'), id: 'refund' } // not linked to anything
    const shirt = { ...tx('2026-10-05', 'expense', 40, 'Shopping'), id: 'shirt' }
    const pay = { ...tx('2026-10-01', 'income', 3000, 'Salary'), id: 'pay' }
    const all = attributeReimbursements([dinner, sam, alex, refund, shirt, pay])

    it('counts a linked payback in the month of the expense it pays back', () => {
        expect(all.find(t => t.id === 'sam')!.date).toBe('2026-09-30')
        expect(all.find(t => t.id === 'refund')!.date).toBe('2026-10-10')
        expect(all.find(t => t.id === 'dinner')!.date).toBe('2026-09-30')
    })

    it('leaves a payback on its own date when its expense is not in the list', () => {
        expect(attributeReimbursements([sam])[0].date).toBe('2026-10-02')
    })

    it('net spending subtracts reimbursements', () => {
        expect(netSpent(all)).toBe(120 + 40 - 90 - 15)
    })

    it('a split dinner costs your share in its month, and does not touch the next month', () => {
        const sept = all.filter(t => inPeriod(t, 'month', 2026, 9))
        const oct = all.filter(t => inPeriod(t, 'month', 2026, 10))
        expect(netSpent(sept)).toBe(30)
        expect(netSpent(oct)).toBe(40 - 15)
    })

    it('does not count paybacks as income', () => {
        expect(overview(all, 2026)).toMatchObject({ income: 3000, expenses: 55 })
    })

    it('balance counts money coming back', () => {
        expect(overview(all, 2026).balance).toBe(3000 - 160 + 105)
    })

    it('budget actuals and category spending are net of paybacks', () => {
        expect(actualAmount(all, 'Food', 'expense')).toBe(30)
        expect(actualAmount(all, 'Shopping', 'expense')).toBe(25)
        expect(spendingByCategory(all)).toEqual([{ label: 'Food', amount: 30 }, { label: 'Shopping', amount: 25 }])
    })

    it('leaves out a category whose paybacks cover all of its spending', () => {
        const list = attributeReimbursements([dinner, { ...sam, amount: 120 }])
        expect(spendingByCategory(list)).toEqual([])
    })

    it('the trend chart and budget health use net spending', () => {
        expect(monthlyTrend(all, [{ month: 9, year: 2026, label: 'Sep' }])[0]).toMatchObject({ expense: 30, net: -30 })
        const health = budgetHealth([{ id: 'f', name: 'Food', type: 'expense' }], [{ budget_item_id: 'f', month: 9, amount: 50 }], all, 2026)
        expect(health).toMatchObject({ actual: 30, score: 100 })
    })
})
