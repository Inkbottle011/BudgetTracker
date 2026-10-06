import { owedToYou, matchingPayments, totalShares } from '../splits'

const tx = (id: string, date: string, type: string, amount: number | string, extra: any = {}) =>
    ({ id, date, type, amount, name: id, category_label: 'Food', ...extra }) as any
const share = (id: string, expense_id: string, person: string, amount: number | string, settled_by: string | null = null) =>
    ({ id, expense_id, person, amount, settled_by }) as any

const dinner = tx('dinner', '2026-09-30', 'expense', 120)
const tickets = tx('tickets', '2026-10-04', 'expense', 80, { category_label: 'Fun' })
const shares = [
    share('s1', 'dinner', 'Sam', 30, 'venmo-sam'),
    share('s2', 'dinner', 'Alex', 30),
    share('s3', 'dinner', 'Jo', '30'),
    share('s4', 'tickets', 'Alex', 40),
]

describe('owedToYou', () => {
    const owed = owedToYou(shares, [dinner, tickets])

    it('totals what is still unpaid', () => {
        expect(owed.total).toBe(100)
    })

    it('groups unpaid shares by expense, newest expense first', () => {
        expect(owed.expenses.map(e => [e.expense.id, e.outstanding, e.unpaid.map(s => s.person)])).toEqual([
            ['tickets', 40, ['Alex']],
            ['dinner', 60, ['Alex', 'Jo']],
        ])
    })

    it('totals by person, biggest first', () => {
        expect(owed.byPerson).toEqual([{ person: 'Alex', amount: 70 }, { person: 'Jo', amount: 30 }])
    })

    it('treats names as the same person regardless of case and spaces', () => {
        const o = owedToYou([share('a', 'dinner', 'alex ', 10), share('b', 'tickets', 'Alex', 5)], [dinner, tickets])
        expect(o.byPerson).toEqual([{ person: 'alex', amount: 15 }])
    })

    it('ignores shares whose expense was deleted', () => {
        expect(owedToYou([share('x', 'gone', 'Sam', 10)], [dinner]).total).toBe(0)
    })

    it('is empty when everyone has paid', () => {
        expect(owedToYou([share('s1', 'dinner', 'Sam', 30, 'r')], [dinner])).toEqual({ total: 0, expenses: [], byPerson: [] })
    })
})

describe('totalShares', () => {
    it('adds up what others owe, ignoring blank rows', () => {
        expect(totalShares([{ person: 'Sam', amount: '30' }, { person: 'Alex', amount: '$30.50' }, { person: '', amount: '' }])).toBe(60.5)
    })
})

describe('matchingPayments', () => {
    const incoming = [
        tx('venmo-a', '2026-10-02', 'income', 30, { name: 'VENMO CASHOUT' }),
        tx('venmo-b', '2026-10-20', 'income', '30.00', { name: 'Venmo' }),
        tx('too-early', '2026-09-20', 'income', 30),
        tx('too-late', '2026-12-15', 'income', 30),
        tx('wrong-amount', '2026-10-02', 'income', 31),
        tx('spending', '2026-10-02', 'expense', 30),
        tx('loose-refund', '2026-10-03', 'reimbursement', 30),
        tx('linked-refund', '2026-10-03', 'reimbursement', 30, { reimburses_id: 'other' }),
        tx('venmo-sam', '2026-10-01', 'reimbursement', 30, { reimburses_id: 'dinner' }),
    ]

    it('finds money coming in for the same amount within 60 days after the expense, closest first', () => {
        const m = matchingPayments(share('s2', 'dinner', 'Alex', 30), dinner, incoming, shares)
        expect(m.map(t => t.id)).toEqual(['venmo-a', 'loose-refund', 'venmo-b'])
    })

    it('skips payments already used to settle another share', () => {
        const used = [...shares, share('s9', 'tickets', 'Bo', 30, 'venmo-a')]
        const m = matchingPayments(share('s2', 'dinner', 'Alex', 30), dinner, incoming, used)
        expect(m.map(t => t.id)).not.toContain('venmo-a')
    })
})
