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

    it('leaves out payments arriving on a credit card', () => {
        const r = convertBankTransactions([tx('t1', '2026-10-01', 500, 'Payment Thank You-Mobile', { providerAccountId: 'acc_card' })], card, ctx())
        expect(r.rows).toEqual([])
        expect(r.skipped.cardPayment).toBe(1)
    })

    it('leaves out card bill payments from checking when the card is linked too, so purchases are not counted twice', () => {
        const bill = tx('t1', '2026-10-01', -500, 'CHASE CREDIT CRD AUTOPAY')
        expect(convertBankTransactions([bill], checking, ctx({ hasLinkedCreditCard: true })).rows).toEqual([])
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
        expect(r.rows.map(x => [x.name, x.type])).toEqual([['Amazon', 'expense'], ['Netflix.com', 'expense']])
    })

    it('rounds amounts to cents', () => {
        expect(convertBankTransactions([tx('t', '2026-10-01', -1.005, 'x')], checking, ctx()).rows[0].amount).toBe(1.01)
    })
})
