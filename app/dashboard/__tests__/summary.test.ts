import { periodRange, shiftAnchor, periodTitle, inRange, plannedForRange, periodElapsed, daysLeftAfterToday, periodSummary, budgetRows, goalRows, accountsSummary, activityDirection, budgetTone } from '../summary'

const tx = (date: string, type: string, amount: number, category_label = '', name = '') => ({ id: `${date}${type}${amount}${name}`, date, type, amount, category_label, name })

describe('periodSummary', () => {
    const list = [
        tx('2026-10-01', 'income', 1200),
        tx('2026-10-02', 'expense', 300, 'Food'),
        tx('2026-10-03', 'reimbursement', 50, 'Food'),
        tx('2026-10-04', 'savings', 400),
        tx('2026-10-05', 'withdrawal', 100),
        tx('2026-10-06', 'transfer', 999),
        tx('2026-09-30', 'expense', 80, 'Food'),
    ]
    it('totals the month: earned, spent (net of paybacks), saved (net of withdrawals), and what\'s left', () => {
        expect(periodSummary(list, periodRange('month', '2026-10-12'))).toEqual({ income: 1200, spent: 250, saved: 300, left: 950 })
    })
    it('or the year', () => {
        expect(periodSummary(list, periodRange('year', '2026-10-12')).spent).toBe(330)
    })
    it('or a week, or a day', () => {
        expect(periodSummary(list, periodRange('week', '2026-10-01')).spent).toBe(330) // Sep 28 - Oct 4
        expect(periodSummary(list, periodRange('day', '2026-10-02')).spent).toBe(300)
    })
})

describe('periods', () => {
    it('a day, a week (Monday to Sunday), a month or a year around a date', () => {
        expect(periodRange('day', '2026-10-12')).toEqual({ start: '2026-10-12', end: '2026-10-13' })
        expect(periodRange('week', '2026-10-12')).toEqual({ start: '2026-10-12', end: '2026-10-19' })   // a Monday
        expect(periodRange('week', '2026-10-01')).toEqual({ start: '2026-09-28', end: '2026-10-05' })   // a Thursday
        expect(periodRange('week', '2026-10-18')).toEqual({ start: '2026-10-12', end: '2026-10-19' })   // a Sunday ends the week
        expect(periodRange('month', '2026-10-12')).toEqual({ start: '2026-10-01', end: '2026-11-01' })
        expect(periodRange('month', '2026-12-05')).toEqual({ start: '2026-12-01', end: '2027-01-01' })
        expect(periodRange('year', '2026-10-12')).toEqual({ start: '2026-01-01', end: '2027-01-01' })
    })

    it('moves back and forward a whole period', () => {
        expect(shiftAnchor('day', '2026-10-01', -1)).toBe('2026-09-30')
        expect(shiftAnchor('week', '2026-10-12', 1)).toBe('2026-10-19')
        expect(shiftAnchor('month', '2026-01-31', -1)).toBe('2025-12-01')
        expect(shiftAnchor('year', '2026-10-12', 1)).toBe('2027-01-01')
    })

    it('has a readable title', () => {
        const today = '2026-10-12'
        expect(periodTitle('day', periodRange('day', today), today)).toBe('Today')
        expect(periodTitle('day', periodRange('day', '2026-10-11'), today)).toBe('Yesterday')
        expect(periodTitle('day', periodRange('day', '2026-10-05'), today)).toBe('Mon, Oct 5')
        expect(periodTitle('week', periodRange('week', today), today)).toBe('Oct 12 – 18')
        expect(periodTitle('week', periodRange('week', '2026-10-01'), today)).toBe('Sep 28 – Oct 4')
        expect(periodTitle('month', periodRange('month', today), today)).toBe('October 2026')
        expect(periodTitle('year', periodRange('year', today), today)).toBe('2026')
    })

    it('knows which dates are inside', () => {
        const r = periodRange('week', '2026-10-12')
        expect(['2026-10-11', '2026-10-12', '2026-10-18', '2026-10-19'].map(d => inRange(d, r))).toEqual([false, true, true, false])
    })
})

describe('plannedForRange (your monthly plan, spread evenly over the days)', () => {
    const amounts = [
        { budget_item_id: 'food', year: 2026, month: 9, amount: 300 },   // Sept: $10/day
        { budget_item_id: 'food', year: 2026, month: 10, amount: 310 },  // Oct: $10/day
        { budget_item_id: 'food', year: 2026, month: 11, amount: 600 },
    ]
    it('a month is the month\'s amount, a year all twelve', () => {
        expect(plannedForRange(amounts, 'food', periodRange('month', '2026-10-12'))).toBe(310)
        expect(plannedForRange(amounts, 'food', periodRange('year', '2026-10-12'))).toBe(1210)
    })
    it('a week or a day is its share of the month, even across two months', () => {
        expect(plannedForRange(amounts, 'food', periodRange('week', '2026-10-12'))).toBe(70)
        expect(plannedForRange(amounts, 'food', periodRange('week', '2026-10-01'))).toBe(70)   // 3 Sept days + 4 Oct days
        expect(plannedForRange(amounts, 'food', periodRange('day', '2026-11-03'))).toBe(20)
    })
    it('amounts without a year count for any year', () => {
        expect(plannedForRange([{ budget_item_id: 'food', month: 10, amount: 310 }], 'food', periodRange('day', '2026-10-12'))).toBe(10)
    })
})

describe('periodElapsed (how far through the period today is)', () => {
    const today = '2026-10-12'
    it('is part-way through the current month, counting today', () => expect(periodElapsed(periodRange('month', today), today)).toBeCloseTo(12 / 31))
    it('is all of a past period and none of a future one', () => {
        expect(periodElapsed(periodRange('month', '2026-09-01'), today)).toBe(1)
        expect(periodElapsed(periodRange('month', '2026-11-01'), today)).toBe(0)
    })
    it('works for weeks, days and years', () => {
        expect(periodElapsed(periodRange('week', today), today)).toBeCloseTo(1 / 7)
        expect(periodElapsed(periodRange('day', today), today)).toBe(1)
        expect(periodElapsed(periodRange('year', today), today)).toBeCloseTo(285 / 365)
    })
    it('counts the days left after today', () => {
        expect(daysLeftAfterToday(periodRange('month', today), today)).toBe(19)
        expect(daysLeftAfterToday(periodRange('month', '2026-09-01'), today)).toBeNull()
    })
})

describe('budgetRows', () => {
    const items = [
        { id: 'food', name: 'Food', type: 'expense' },
        { id: 'fun', name: 'Entertainment', type: 'expense' },
        { id: 'subs', name: 'Subscriptions', type: 'expense' },
        { id: 'pay', name: 'Fenner', type: 'income' },
    ]
    const amounts = [
        { budget_item_id: 'food', month: 10, amount: 400 },
        { budget_item_id: 'fun', month: 10, amount: 100 },
        { budget_item_id: 'subs', month: 10, amount: 0 },
        { budget_item_id: 'pay', month: 10, amount: 1800 },
    ]
    const list = [
        tx('2026-10-02', 'expense', 120, 'Food'),
        tx('2026-10-03', 'expense', 130, 'Entertainment'),
        tx('2026-10-04', 'reimbursement', 10, 'Entertainment'),
        tx('2026-10-05', 'expense', 40, ''),               // uncategorized
        tx('2026-10-05', 'expense', 25, 'Gifts'),          // a category with no budget
    ]
    it('one row per spending category: spent vs planned, left or over; overspent first, then by amount', () => {
        const r = budgetRows(items, amounts, list, periodRange('month', '2026-10-12'))
        expect(r.rows).toEqual([
            { name: 'Entertainment', planned: 100, spent: 120, left: -20 },
            { name: 'Food', planned: 400, spent: 120, left: 280 },
            { name: 'Gifts', planned: 0, spent: 25, left: -25 },
            { name: 'Subscriptions', planned: 0, spent: 0, left: 0 },
        ])
        expect(r.uncategorized).toBe(40)
        expect(r.totalPlanned).toBe(500)
    })
})

describe('goalRows (income and savings against the plan)', () => {
    it('compares what came in and what was saved with the plan', () => {
        const items = [{ id: 'pay', name: 'Fenner', type: 'income' }, { id: 'sav', name: 'Sofi Savings', type: 'savings' }]
        const amounts = [{ budget_item_id: 'pay', month: 10, amount: 1800 }, { budget_item_id: 'sav', month: 10, amount: 500 }]
        const list = [tx('2026-10-01', 'income', 900, 'Fenner'), tx('2026-10-02', 'savings', 600, 'Sofi Savings'), tx('2026-10-09', 'withdrawal', 200, 'Sofi Savings')]
        expect(goalRows(items, amounts, list, periodRange('month', '2026-10-12'))).toEqual([
            { name: 'Fenner', type: 'income', planned: 1800, actual: 900 },
            { name: 'Sofi Savings', type: 'savings', planned: 500, actual: 400 },
        ])
    })
})

describe('accountsSummary', () => {
    it('adds up checking, savings (vaults included) and what\'s owed on cards', () => {
        const s = accountsSummary([
            { id: '1', name: 'SoFi Checking', type: 'depository', subtype: 'checking', balance_current: 1843.22 },
            { id: '2', name: 'Santander', type: 'depository', subtype: 'checking', balance_current: '622.18' },
            { id: '3', name: 'SoFi Savings', type: 'depository', subtype: 'savings', balance_current: 2410.55 },
            { id: '4', name: 'Car', type: 'depository', subtype: 'cash management', balance_current: 300 },
            { id: '5', name: 'Quicksilver', type: 'credit', subtype: 'credit card', balance_current: 412.37 },
            { id: '6', name: 'New card', type: 'credit', subtype: 'credit card', balance_current: null },
        ] as any)
        expect(s.cash.total).toBeCloseTo(2465.4)
        expect(s.savings.total).toBeCloseTo(2710.55)
        expect(s.cards.total).toBeCloseTo(412.37)
        expect(s.cash.accounts.map(a => a.name)).toEqual(['SoFi Checking', 'Santander'])
        expect(s.savings.accounts.map(a => a.name)).toEqual(['SoFi Savings', 'Car'])
        expect(s.cards.accounts.map(a => a.name)).toEqual(['Quicksilver', 'New card'])
        expect(s.any).toBe(true)
    })
    it('says when no banks are linked', () => {
        expect(accountsSummary([]).any).toBe(false)
    })
})

describe('activityDirection', () => {
    it.each([
        ['income', 'in'], ['reimbursement', 'in'], ['withdrawal', 'in'],
        ['expense', 'out'], ['savings', 'out'], ['investment', 'out'],
        ['transfer', 'move'],
    ])('%p is %p', (type, dir) => expect(activityDirection(type)).toBe(dir))
})

describe('budgetTone', () => {
    it('says how a category is doing, for coloring its bar', () => {
        expect(budgetTone(0, 0)).toBe('unplanned')
        expect(budgetTone(40, 0)).toBe('unplanned')
        expect(budgetTone(40, 100)).toBe('onTrack')
        expect(budgetTone(84, 100)).toBe('onTrack')
        expect(budgetTone(85, 100)).toBe('close')
        expect(budgetTone(100, 100)).toBe('close')
        expect(budgetTone(100.01, 100)).toBe('over')
    })
})
