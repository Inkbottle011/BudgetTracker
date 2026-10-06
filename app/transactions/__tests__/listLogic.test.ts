import { withRunningBalance, filterTransactions, sortTransactions, toCSV } from '../listLogic'

const tx = (id: string, date: string, type: string, amount: number, extra: any = {}) =>
    ({ id, date, type, amount, name: '', note: '', category_label: '', ...extra }) as any

describe('withRunningBalance', () => {
    it('adds income and subtracts expenses, newest first', () => {
        const rows = withRunningBalance([
            tx('b', '2026-10-02', 'expense', 30),
            tx('a', '2026-10-01', 'income', 100),
            tx('c', '2026-10-03', 'expense', 20),
        ])
        expect(rows.map(r => [r.id, r.balance])).toEqual([['c', 50], ['b', 70], ['a', 100]])
    })

    it('matches the dashboard balance: savings and investments do not change it', () => {
        const rows = withRunningBalance([
            tx('a', '2026-10-01', 'income', 100),
            tx('b', '2026-10-02', 'savings', 40),
            tx('c', '2026-10-03', 'investment', 10),
        ])
        expect(rows[0].balance).toBe(100)
    })

    it('keeps the original order for transactions on the same day', () => {
        const rows = withRunningBalance([
            tx('a', '2026-10-01', 'income', 100),
            tx('b', '2026-10-01', 'expense', 10),
        ])
        expect(rows.map(r => [r.id, r.balance])).toEqual([['b', 90], ['a', 100]])
    })

    it('handles amounts stored as text', () => {
        expect(withRunningBalance([tx('a', '2026-10-01', 'income', '12.5' as any)])[0].balance).toBe(12.5)
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
        const csv = toCSV([{ ...tx('1', '2026-10-01', 'expense', 5, { name: 'Joe\'s "Diner"', note: 'a,b' }), balance: -5 }])
        expect(csv.split('\n')).toEqual([
            'Date,Type,Category,Name,Amount,Details,Balance',
            '"2026-10-01","expense","","Joe\'s ""Diner""","5","a,b","-5"',
        ])
    })
})

import { listSummary } from '../listLogic'

describe('reimbursements in the list', () => {
    it('the running balance goes up when money is paid back', () => {
        const rows = withRunningBalance([
            tx('a', '2026-10-01', 'expense', 120),
            tx('b', '2026-10-02', 'reimbursement', 90),
        ])
        expect(rows[0].balance).toBe(-30)
    })

    it('the summary shows income, spending net of paybacks, and the difference', () => {
        expect(listSummary([
            tx('1', '2026-10-01', 'income', 1000),
            tx('2', '2026-10-01', 'expense', 120),
            tx('3', '2026-10-02', 'reimbursement', 90),
            tx('4', '2026-10-02', 'savings', 200),
        ])).toEqual({ income: 1000, spent: 30, net: 970 })
    })
})
