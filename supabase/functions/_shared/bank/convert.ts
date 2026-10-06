// Turns a provider's transactions into rows for the transactions table, applying the same rules
// as the CSV import: skip what you already have, leave out card payments, guess categories.
import { buildCategoryGuesser, duplicateKey, isCardPayment, isCardBillPayment, isRefund, PastTransaction } from '../entry.ts'
import type { BankTransaction } from './types.ts'

export interface ConvertContext {
    userId: string
    provider: string
    syncFrom: string
    history: PastTransaction[]
    /** Transactions you already have without a bank id (typed in or from a CSV import) */
    existing: { date: string; amount: number | string; name?: string | null; note?: string | null }[]
    /** Whether any credit card is linked; if so, card bill payments from checking are left out */
    hasLinkedCreditCard: boolean
}

export interface TransactionRow {
    user_id: string
    provider: string
    external_id: string
    bank_account_id: string
    date: string
    amount: number
    type: string
    name: string
    note: string
    category_label: string
    category_id: null
}

export function convertBankTransactions(
    transactions: BankTransaction[],
    account: { id: string; type: string; providerAccountId: string },
    ctx: ConvertContext,
) {
    const skipped = { pending: 0, beforeStart: 0, duplicate: 0, cardPayment: 0 }
    const guess = buildCategoryGuesser(ctx.history)

    const alreadySaved = new Map<string, number>()
    for (const t of ctx.existing) {
        const k = duplicateKey({ ...t, amount: Number(t.amount) })
        alreadySaved.set(k, (alreadySaved.get(k) ?? 0) + 1)
    }

    // Some providers show card purchases as positive. Card payments are money IN to a card,
    // so if they mostly look negative, this account's signs are the other way round.
    let sign = 1
    if (account.type === 'credit') {
        const payments = transactions.filter(t => isCardPayment(t.description))
        if (payments.length && payments.filter(t => t.amount < 0).length > payments.length / 2) sign = -1
    }

    const rows: TransactionRow[] = []
    for (const t of transactions) {
        if (t.pending) { skipped.pending++; continue }
        if (t.date < ctx.syncFrom) { skipped.beforeStart++; continue }

        const amount = sign * t.amount
        const moneyOut = amount < 0
        if (!moneyOut && isCardPayment(t.description)) { skipped.cardPayment++; continue }
        if (moneyOut && account.type !== 'credit' && ctx.hasLinkedCreditCard && isCardBillPayment(t.description)) {
            skipped.cardPayment++; continue
        }

        const value = Math.round((Math.abs(amount) + Number.EPSILON) * 100) / 100
        const key = duplicateKey({ date: t.date, amount: value, name: t.description })
        const saved = alreadySaved.get(key) ?? 0
        if (saved > 0) { alreadySaved.set(key, saved - 1); skipped.duplicate++; continue }

        let type = moneyOut ? 'expense' : 'income'
        let category = ''
        const g = guess(t.description)
        // Money coming back on a card (that isn't paying it off), or a refund into checking,
        // reduces spending in the purchase's category instead of counting as income
        if (!moneyOut && (account.type === 'credit' || isRefund(t.description))) {
            type = 'reimbursement'
            if (g?.type === 'expense') category = g.category
        } else if (g && (g.type === type || (type === 'expense' && (g.type === 'savings' || g.type === 'investment')))) {
            type = g.type
            category = g.category
        }

        rows.push({
            user_id: ctx.userId, provider: ctx.provider, external_id: t.externalId, bank_account_id: account.id,
            date: t.date, amount: value, type, name: t.description, note: '', category_label: category, category_id: null,
        })
    }
    return { rows, skipped }
}
