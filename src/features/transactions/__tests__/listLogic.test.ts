import { filterTransactions, sortTransactions, toCSV, displayDate, amountText } from '../logic/listLogic'

const tx = (id: string, date: string, type: string, amount: number, extra: any = {}) =>
    ({ id, date, type, amount, name: '', note: '', category_label: '', ...extra }) as any

describe('displayDate', () => {
    it('reads like "Oct 6", adding the year only when it is not this year', () => {
        expect(displayDate('2026-10-06', '2026-10-12')).toBe('Oct 6')
        expect(displayDate('2026-01-31', '2026-10-12')).toBe('Jan 31')
        expect(displayDate('2025-12-24', '2026-10-12')).toBe('Dec 24, 2025')
    })

    it('copes with timestamps and leaves unreadable dates alone', () => {
        expect(displayDate('2026-03-05T23:30:00Z', '2026-10-12')).toBe('Mar 5')
        expect(displayDate('soon', '2026-10-12')).toBe('soon')
    })
})

describe('amountText', () => {
    it('money in is green-ish with a plus, money out has a minus, transfers have no sign', () => {
        expect(amountText({ type: 'income', amount: 2000 })).toEqual({ text: '+$2,000.00', direction: 'in' })
        expect(amountText({ type: 'reimbursement', amount: '15' })).toEqual({ text: '+$15.00', direction: 'in' })
        expect(amountText({ type: 'withdrawal', amount: 50 })).toEqual({ text: '+$50.00', direction: 'in' })
        expect(amountText({ type: 'expense', amount: 15.99 })).toEqual({ text: '-$15.99', direction: 'out' })
        expect(amountText({ type: 'savings', amount: 100 })).toEqual({ text: '-$100.00', direction: 'out' })
        expect(amountText({ type: 'transfer', amount: 500 })).toEqual({ text: '$500.00', direction: 'move' })
    })
})

describe('filterTransactions', () => {
    const list = [
        tx('1', '2026-09-30', 'expense', 5, { name: 'Coffee', category_label: 'Food' }),
        tx('2', '2026-10-01', 'income', 100, { name: 'Paycheck', note: 'October' }),
        tx('3', '2026-10-15', 'expense', 50, { name: 'Groceries', category_label: 'Food' }),
    ]
    const none = { search: '', type: null, from: '', to: '' }
    const ids = (f: any) => filterTransactions(list, { ...none, ...f }).map(t => t.id)

    it('returns everything with no filters', () => { expect(ids({})).toEqual(['1', '2', '3']) })
    it('searches name, note, category, type and date, ignoring case', () => {
        expect(ids({ search: 'COFFEE' })).toEqual(['1'])
        expect(ids({ search: 'october' })).toEqual(['2'])
        expect(ids({ search: 'food' })).toEqual(['1', '3'])
        expect(ids({ search: 'income' })).toEqual(['2'])
        expect(ids({ search: '2026-10' })).toEqual(['2', '3'])
    })
    it('filters by type', () => { expect(ids({ type: 'Expense' })).toEqual(['1', '3']) })
    it('filters by date range, including both ends', () => {
        expect(ids({ from: '2026-10-01', to: '2026-10-15' })).toEqual(['2', '3'])
        expect(ids({ to: '2026-09-30' })).toEqual(['1'])
    })
    it('combines filters', () => { expect(ids({ type: 'Expense', search: 'gro', from: '2026-10-01' })).toEqual(['3']) })
})

describe('sortTransactions', () => {
    const list = [
        tx('1', '2026-10-02', 'income', 5),
        tx('2', '2026-10-01', 'expense', 50),
        tx('3', '2026-10-03', 'savings', 20),
    ]
    const ids = (col: string, dir: 'asc' | 'desc') => sortTransactions(list, col, dir).map(t => t.id)

    it('sorts by date', () => {
        expect(ids('date', 'asc')).toEqual(['2', '1', '3'])
        expect(ids('date', 'desc')).toEqual(['3', '1', '2'])
    })
    it('sorts by amount as numbers', () => {
        expect(ids('amount', 'asc')).toEqual(['1', '3', '2'])
    })
    it('sorts by type', () => { expect(ids('type', 'asc')).toEqual(['2', '1', '3']) })
    it('leaves the order alone for unknown columns and does not change the input', () => {
        expect(ids('nope', 'asc')).toEqual(['1', '2', '3'])
        expect(list.map(t => t.id)).toEqual(['1', '2', '3'])
    })
})

describe('toCSV', () => {
    it('writes a header and quotes every value, escaping quotes', () => {
        const csv = toCSV([tx('1', '2026-10-01', 'expense', 5, { name: 'Joe\'s "Diner"', note: 'a,b' })])
        expect(csv.split('\n')).toEqual([
            'Date,Type,Category,Name,Amount,Details',
            '"2026-10-01","expense","","Joe\'s ""Diner""","5","a,b"',
        ])
    })
})

import { listSummary } from '../logic/listLogic'

describe('reimbursements in the list', () => {
    it('the summary shows income, spending net of paybacks, and the difference', () => {
        expect(listSummary([
            tx('1', '2026-10-01', 'income', 1000),
            tx('2', '2026-10-01', 'expense', 120),
            tx('3', '2026-10-02', 'reimbursement', 90),
            tx('4', '2026-10-02', 'savings', 200),
        ])).toEqual({ income: 1000, spent: 30, net: 970 })
    })
})

import { TRANSACTION_TYPES } from '../logic/types'

describe('transfers in the list', () => {
    it('are a type you can pick, and are left out of the summary', () => {
        expect(TRANSACTION_TYPES).toContain('Transfer')
        const list = [tx('a', '2026-10-01', 'income', 100), tx('b', '2026-10-02', 'transfer', 500)]
        expect(listSummary(list)).toEqual({ income: 100, spent: 0, net: 100 })
    })

    it('can be filtered', () => {
        const list = [tx('a', '2026-10-01', 'income', 100), tx('b', '2026-10-02', 'transfer', 500)]
        expect(filterTransactions(list, { search: '', type: 'Transfer', from: '', to: '' }).map(t => t.id)).toEqual(['b'])
    })
})

describe('savings in the list', () => {
    it('Withdrawal is a type you can pick and filter by', () => {
        expect(TRANSACTION_TYPES).toContain('Withdrawal')
        const list = [tx('a', '2026-10-01', 'income', 100), tx('b', '2026-10-02', 'withdrawal', 50)]
        expect(filterTransactions(list, { search: '', type: 'Withdrawal', from: '', to: '' }).map(t => t.id)).toEqual(['b'])
    })
})

import { presetRange, describeFilters, UNCATEGORIZED } from '../logic/listLogic'

describe('date presets', () => {
    const today = '2026-10-22'
    it('turns a preset into dates, counted from today', () => {
        expect(presetRange('all', today)).toEqual({ from: '', to: '' })
        expect(presetRange('thisMonth', today)).toEqual({ from: '2026-10-01', to: '2026-10-31' })
        expect(presetRange('lastMonth', today)).toEqual({ from: '2026-09-01', to: '2026-09-30' })
        expect(presetRange('lastMonth', '2026-01-15')).toEqual({ from: '2025-12-01', to: '2025-12-31' })
        expect(presetRange('last30', today)).toEqual({ from: '2026-09-23', to: '2026-10-22' })
        expect(presetRange('thisYear', today)).toEqual({ from: '2026-01-01', to: '2026-12-31' })
    })
})

describe('filtering by category', () => {
    const list = [
        tx('1', '2026-10-01', 'expense', 5, { category_label: 'Eating out' }),
        tx('2', '2026-10-02', 'reimbursement', 2, { category_label: 'eating out' }),
        tx('3', '2026-10-03', 'expense', 9, { category_label: 'Groceries' }),
        tx('4', '2026-10-04', 'expense', 7, { category_label: '' }),
        tx('5', '2026-10-05', 'transfer', 50, { category_label: '' }),
    ]
    const none = { search: '', type: null, from: '', to: '' }
    it('keeps that category (paybacks too), ignoring case', () => {
        expect(filterTransactions(list, { ...none, category: 'Eating Out' }).map(t => t.id)).toEqual(['1', '2'])
    })
    it('"Uncategorized" is spending with no category (not transfers)', () => {
        expect(filterTransactions(list, { ...none, category: UNCATEGORIZED }).map(t => t.id)).toEqual(['4'])
    })
})

describe('describeFilters (the line that says what is being shown)', () => {
    it('names the category, type and dates', () => {
        expect(describeFilters({ type: null, category: 'Eating out', from: '2026-10-01', to: '2026-10-31' }, '2026-10-22')).toBe('Eating out · Oct 1 – Oct 31')
        expect(describeFilters({ type: 'Income', category: null, from: '2026-09-01', to: '' }, '2026-10-22')).toBe('Income · from Sep 1')
        expect(describeFilters({ type: null, category: null, from: '', to: '' }, '2026-10-22')).toBe('')
    })
})
