// Turns a provider's transactions into rows for the transactions table, applying the same rules
// as the CSV import: skip what you already have, leave out card payments, guess categories.
import { buildCategoryGuesser, duplicateKey, merchantKey, isCardPayment, isRefund, renameFor, PastTransaction } from '../entry.ts'
import type { BankTransaction } from './types.ts'

export interface ConvertContext {
    userId: string
    provider: string
    syncFrom: string
    history: PastTransaction[]
    /** Transactions you already have without a bank id (typed in or from a CSV import) */
    existing: ExistingTransaction[]
    /** Bank transaction ids already saved, or waiting for you to review: never added again */
    alreadyImported?: Set<string>
    /** Your names for places (merchantKey -> name). Absent before renaming is set up. */
    renames?: Map<string, string>
    /** Whether any credit card is linked (kept for callers; card payments are now paired by the sync) */
    hasLinkedCreditCard?: boolean
}

export interface ExistingTransaction {
    id?: string
    date: string
    amount: number | string
    name?: string | null
    note?: string | null
    original_name?: string | null
    type?: string | null
}

/** A bank transaction that might be one you already have: you decide (see bank_possible_duplicates). */
export interface PossibleDuplicate {
    row: TransactionRow
    existing_transaction_id: string | null
}

/** How many days apart the bank's date and yours can be (purchase date vs. posting date). */
export const MATCH_DAYS = 3
/** Same amount at the same place can be further apart: card purchases sometimes post days later. */
export const SAME_PLACE_DAYS = 7

export const MONEY_IN_TYPES = new Set(['income', 'reimbursement'])

function daysApart(a: string, b: string) {
    return Math.abs(Date.parse(`${a.slice(0, 10)}T00:00:00Z`) - Date.parse(`${b.slice(0, 10)}T00:00:00Z`)) / 86_400_000
}

/** "Blue Bottle" and "SQ *BLUE BOTTLE #12" are the same place; so are "Starbucks" and "STARBUCKS STORE 123". */
function samePlace(a: unknown, b: unknown) {
    const x = merchantKey(a), y = merchantKey(b)
    return !!x && !!y && (x === y || x.startsWith(`${y} `) || y.startsWith(`${x} `))
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
    /** The bank's wording when you've renamed the place (only present once renaming is set up) */
    original_name?: string | null
}

export function convertBankTransactions(
    transactions: BankTransaction[],
    account: { id: string; type: string; providerAccountId: string },
    ctx: ConvertContext,
) {
    const skipped = { pending: 0, beforeStart: 0, duplicate: 0, cardPayment: 0, alreadyImported: 0 }
    const guess = buildCategoryGuesser(ctx.history)

    // Some providers show card purchases as positive. Card payments are money IN to a card,
    // so if they mostly look negative, this account's signs are the other way round.
    let sign = 1
    if (account.type === 'credit') {
        const payments = transactions.filter(t => isCardPayment(t.description))
        if (payments.length && payments.filter(t => t.amount < 0).length > payments.length / 2) sign = -1
    }

    // 1. Decide what each bank transaction is
    const candidates: TransactionRow[] = []
    const moneyIn = new Set<string>()   // external ids of money coming in (a transfer's type doesn't say)
    for (const t of transactions) {
        if (t.pending) { skipped.pending++; continue }
        if (t.date < ctx.syncFrom) { skipped.beforeStart++; continue }
        if (ctx.alreadyImported?.has(t.externalId)) { skipped.alreadyImported++; continue }

        const amount = sign * t.amount
        const moneyOut = amount < 0
        const value = Math.round((Math.abs(amount) + Number.EPSILON) * 100) / 100
        let type = moneyOut ? 'expense' : 'income'
        let category = ''
        const g = guess(t.description)
        // A payment arriving on a card is money moving between your own accounts: the purchases on the
        // card are the spending. Saved as a transfer (never counted); the sync then pairs it with the
        // payment leaving checking. A payment from checking with no linked card on the other end stays
        // spending, since it's the only record of what was bought on that card.
        if (!moneyOut && isCardPayment(t.description)) {
            skipped.cardPayment++
            type = 'transfer'
        // Money coming back on a card (that isn't paying it off), or a refund into checking,
        // reduces spending in the purchase's category instead of counting as income
        } else if (!moneyOut && (account.type === 'credit' || isRefund(t.description))) {
            type = 'reimbursement'
            if (g?.type === 'expense') category = g.category
        } else if (g && (g.type === type || (type === 'expense' && (g.type === 'savings' || g.type === 'investment')))) {
            type = g.type
            category = g.category
        }

        if (!moneyOut) moneyIn.add(t.externalId)
        const row: TransactionRow = {
            user_id: ctx.userId, provider: ctx.provider, external_id: t.externalId, bank_account_id: account.id,
            date: t.date, amount: value, type, name: t.description, note: '', category_label: category, category_id: null,
        }
        if (ctx.renames) {
            const named = renameFor(t.description, ctx.renames)
            row.name = named.name
            row.original_name = named.original_name ?? null
        }
        candidates.push(row)
    }

    // 2. Match against what you already have, each of yours at most once.
    //    Exact matches (same date, amount and wording) go first so a near match can't take their place.
    //    Money in only matches money in, and money out only money out.
    const mine = ctx.existing.map(e => ({
        ...e, value: Math.abs(Number(e.amount)), moneyIn: MONEY_IN_TYPES.has(String(e.type ?? 'expense')), used: false,
    }))
    const matched = new Set<TransactionRow>()
    for (const row of candidates) {
        const key = duplicateKey(row)
        const isIn = moneyIn.has(row.external_id)
        const hit = mine.find(m => !m.used && m.moneyIn === isIn && duplicateKey({ ...m, amount: m.value }) === key)
        if (hit) { hit.used = true; matched.add(row); skipped.duplicate++ }
    }

    const rows: TransactionRow[] = []
    const reviews: PossibleDuplicate[] = []
    for (const row of candidates) {
        if (matched.has(row)) continue
        const isIn = moneyIn.has(row.external_id)
        const sameAmount = mine
            .filter(m => !m.used && Math.abs(m.value - row.amount) < 0.005 && daysApart(m.date, row.date) <= SAME_PLACE_DAYS
                && m.moneyIn === isIn)
            .sort((a, b) => daysApart(a.date, row.date) - daysApart(b.date, row.date))
        const same = sameAmount.find(m => samePlace(m.original_name || m.name || m.note, row.original_name || row.name))
        if (same) { same.used = true; skipped.duplicate++; continue }
        const near = sameAmount.find(m => daysApart(m.date, row.date) <= MATCH_DAYS)
        if (near) {
            // Same amount around the same day but a different name: probably yours, but you decide
            near.used = true
            reviews.push({ row, existing_transaction_id: near.id ?? null })
            continue
        }
        rows.push(row)
    }
    return { rows, reviews, skipped, moneyIn }
}
