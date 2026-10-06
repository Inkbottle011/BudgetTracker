/** @jest-environment node */
import { convertBankTransactions } from '../convert.ts'
import type { BankTransaction } from '../types.ts'

const checking = { id: 'db-acc-1', type: 'depository', providerAccountId: 'acc_checking' }
const card = { id: 'db-acc-2', type: 'credit', providerAccountId: 'acc_card' }

const tx = (externalId: string, date: string, amount: number, description: string, extra: Partial<BankTransaction> = {}): BankTransaction =>
    ({ externalId, providerAccountId: 'acc_checking', date, amount, description, pending: false, ...extra })

const ctx = (over: any = {}) => ({
    userId: 'user-1', provider: 'teller', syncFrom: '2026-09-01', history: [], existing: [], hasLinkedCreditCard: false, ...over,
})

describe('convertBankTransactions', () => {
    it('turns bank transactions into transactions, money out as expenses', () => {
        const r = convertBankTransactions([tx('t1', '2026-10-01', -12.5, 'Corner Store'), tx('t2', '2026-10-01', 2000, 'ACME PAYROLL')], checking, ctx())
        expect(r.rows).toEqual([
            { user_id: 'user-1', provider: 'teller', external_id: 't1', bank_account_id: 'db-acc-1', date: '2026-10-01', amount: 12.5, type: 'expense', name: 'Corner Store', note: '', category_label: '', category_id: null },
            { user_id: 'user-1', provider: 'teller', external_id: 't2', bank_account_id: 'db-acc-1', date: '2026-10-01', amount: 2000, type: 'income', name: 'ACME PAYROLL', note: '', category_label: '', category_id: null },
        ])
    })

    it('waits for pending transactions to post (their ids change when they do)', () => {
        const r = convertBankTransactions([tx('t1', '2026-10-01', -5, 'Lunch', { pending: true })], checking, ctx())
        expect(r.rows).toEqual([])
        expect(r.skipped.pending).toBe(1)
    })

    it('ignores anything before the chosen start date', () => {
        const r = convertBankTransactions([tx('t1', '2026-08-31', -5, 'Old')], checking, ctx())
        expect(r.rows).toEqual([])
        expect(r.skipped.beforeStart).toBe(1)
    })

    it('guesses categories from your history, like the CSV import', () => {
        const history = [{ name: 'Blue Bottle Coffee', category_label: 'Coffee', type: 'expense' }]
        const r = convertBankTransactions([tx('t1', '2026-10-01', -6.5, 'SQ *BLUE BOTTLE #1234 OAKLAND CA')], checking, ctx({ history }))
        expect(r.rows[0].category_label).toBe('Coffee')
    })

    it('skips a transaction you already have from a CSV import or typed in, one for one', () => {
        const existing = [{ date: '2026-10-01', amount: 4, name: 'Coffee' }]
        const r = convertBankTransactions([tx('a', '2026-10-01', -4, 'Coffee'), tx('b', '2026-10-01', -4, 'Coffee')], checking, ctx({ existing }))
        expect(r.rows.map(x => x.external_id)).toEqual(['b'])
        expect(r.skipped.duplicate).toBe(1)
    })

    describe('transactions you already have, worded or dated differently', () => {
        it('skips the same purchase at the same place, even a few days apart and worded differently', () => {
            const existing = [{ id: 'mine-1', date: '2026-10-01', amount: 6.5, name: 'SQ *BLUE BOTTLE', type: 'expense' }]
            const r = convertBankTransactions([tx('t1', '2026-10-03', -6.5, 'Blue Bottle Coffee')], checking, ctx({ existing }))
            expect(r.rows).toEqual([])
            expect(r.reviews).toEqual([])
            expect(r.skipped.duplicate).toBe(1)
        })

        it('asks you about the same amount within 3 days when the names don\'t match', () => {
            const existing = [{ id: 'mine-1', date: '2026-10-01', amount: 84.23, name: 'Groceries', type: 'expense' }]
            const r = convertBankTransactions([tx('t1', '2026-10-02', -84.23, 'WHOLE FOODS #10234')], checking, ctx({ existing }))
            expect(r.rows).toEqual([])
            expect(r.reviews).toEqual([{
                existing_transaction_id: 'mine-1',
                row: expect.objectContaining({ external_id: 't1', date: '2026-10-02', amount: 84.23, type: 'expense', name: 'WHOLE FOODS #10234' }),
            }])
        })

        it('treats more than 3 days apart, a different amount, or the other direction as new', () => {
            const existing = [
                { id: 'a', date: '2026-10-01', amount: 20, name: 'Gas', type: 'expense' },
                { id: 'b', date: '2026-10-01', amount: 30, name: 'Paycheck', type: 'income' },
            ]
            const r = convertBankTransactions([
                tx('t1', '2026-10-05', -20, 'Shell'),     // 4 days later
                tx('t2', '2026-10-01', -20.01, 'Shell'),  // a cent off
                tx('t3', '2026-10-01', -30, 'Paycheck'),  // money out, but yours was money in
            ], checking, ctx({ existing }))
            expect(r.rows.map(x => x.external_id)).toEqual(['t1', 't2', 't3'])
            expect(r.reviews).toEqual([])
        })

        it('matches each of your transactions only once, so two real $5 coffees both count', () => {
            const existing = [{ id: 'mine-1', date: '2026-10-01', amount: 5, name: 'Starbucks', type: 'expense' }]
            const r = convertBankTransactions([tx('t1', '2026-10-01', -5, 'STARBUCKS STORE 123'), tx('t2', '2026-10-01', -5, 'STARBUCKS STORE 123')], checking, ctx({ existing }))
            expect(r.rows.map(x => x.external_id)).toEqual(['t2'])
            expect(r.skipped.duplicate).toBe(1)
        })

        it('prefers an exact match over a near one', () => {
            const existing = [
                { id: 'near', date: '2026-10-02', amount: 5, name: 'Coffee', type: 'expense' },
                { id: 'exact', date: '2026-10-01', amount: 5, name: 'Corner Cafe', type: 'expense' },
            ]
            const r = convertBankTransactions([
                tx('t1', '2026-10-02', -5, 'Corner Cafe'),   // close to both of yours
                tx('t2', '2026-10-01', -5, 'Corner Cafe'),   // exactly "exact"
            ], checking, ctx({ existing }))
            // t2 takes "exact"; t1 then pairs with the remaining one, whose name differs, so it's for review
            expect(r.skipped.duplicate).toBe(1)
            expect(r.reviews.map(x => [x.row.external_id, x.existing_transaction_id])).toEqual([['t1', 'near']])
        })

        it('skips bank transactions that were already imported or are waiting for review', () => {
            const existing = [{ id: 'mine-1', date: '2026-10-01', amount: 5, name: 'Coffee', type: 'expense' }]
            const r = convertBankTransactions([tx('t1', '2026-10-01', -5, 'Blue Bottle'), tx('t2', '2026-10-02', -9, 'Lunch')], checking,
                ctx({ existing, alreadyImported: new Set(['t1', 't2']) }))
            expect(r.rows).toEqual([])
            expect(r.reviews).toEqual([])
        })
    })

    it('saves payments arriving on a credit card as transfers, which never count toward totals', () => {
        const r = convertBankTransactions([tx('t1', '2026-10-01', 500, 'Payment Thank You-Mobile', { providerAccountId: 'acc_card' })], card, ctx())
        expect(r.rows).toEqual([expect.objectContaining({ external_id: 't1', type: 'transfer', amount: 500, category_label: '' })])
        expect(r.skipped.cardPayment).toBe(1)
    })

    it('saves card bill payments from checking as transfers when the card is linked too, so purchases are not counted twice', () => {
        const bill = tx('t1', '2026-10-01', -500, 'CHASE CREDIT CRD AUTOPAY')
        expect(convertBankTransactions([bill], checking, ctx({ hasLinkedCreditCard: true })).rows)
            .toEqual([expect.objectContaining({ external_id: 't1', type: 'transfer' })])
        // Without the card linked, the payment is the only record of that spending, so keep it
        expect(convertBankTransactions([bill], checking, ctx({ hasLinkedCreditCard: false })).rows).toHaveLength(1)
    })

    it('fixes the sign for card providers that show purchases as positive numbers', () => {
        const flipped = [
            tx('p', '2026-10-01', 45.99, 'Amazon', { providerAccountId: 'acc_card' }),
            tx('q', '2026-10-02', 12, 'Netflix.com', { providerAccountId: 'acc_card' }),
            tx('pay', '2026-10-03', -500, 'Payment Thank You-Mobile', { providerAccountId: 'acc_card' }),
        ]
        const r = convertBankTransactions(flipped, card, ctx())
        expect(r.rows.map(x => [x.name, x.type])).toEqual([['Amazon', 'expense'], ['Netflix.com', 'expense'], ['Payment Thank You-Mobile', 'transfer']])
        expect(r.moneyIn).toEqual(new Set(['pay']))
    })

    it('records money coming back on a card as a reimbursement in the purchase\'s category, not income', () => {
        const history = [{ name: 'Amazon', category_label: 'Shopping', type: 'expense' }]
        const r = convertBankTransactions([tx('r1', '2026-10-04', 25, 'AMAZON MKTPL*AB12', { providerAccountId: 'acc_card' })], card, ctx({ history }))
        expect(r.rows[0]).toMatchObject({ type: 'reimbursement', category_label: 'Shopping', amount: 25 })
    })

    it('records a card refund as a reimbursement even without history', () => {
        const r = convertBankTransactions([tx('r1', '2026-10-04', 25, 'Some Store')], card, ctx())
        expect(r.rows[0]).toMatchObject({ type: 'reimbursement', category_label: '' })
    })

    it('records a refund into checking as a reimbursement', () => {
        const history = [{ name: 'Target', category_label: 'Shopping', type: 'expense' }]
        const r = convertBankTransactions([tx('r2', '2026-10-04', 30, 'TARGET REFUND')], checking, ctx({ history }))
        expect(r.rows[0]).toMatchObject({ type: 'reimbursement', category_label: 'Shopping' })
    })

    it('still treats normal money into checking as income', () => {
        const r = convertBankTransactions([tx('p', '2026-10-04', 2000, 'ACME PAYROLL')], checking, ctx())
        expect(r.rows[0].type).toBe('income')
    })

    it('rounds amounts to cents', () => {
        expect(convertBankTransactions([tx('t', '2026-10-01', -1.005, 'x')], checking, ctx()).rows[0].amount).toBe(1.01)
    })
})
