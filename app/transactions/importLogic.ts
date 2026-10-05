import { supabase } from '../../lib/supabase'
import {
    parseAmount, parseDate, detectDateOrder, DateOrder, buildCategoryGuesser, duplicateKey, PastTransaction,
} from '../../lib/entry'

export type ImportField = 'date' | 'amount' | 'debit' | 'credit' | 'description' | 'type' | 'category' | 'skip'
export type SpendingSign = 'negative' | 'positive'

const VALID_TYPES = ['income', 'expense', 'savings', 'investment']

// Paying off a credit card shows up as money coming in on the card's statement,
// but it isn't income, just money moving between your own accounts.
const CARD_PAYMENT = /payment\s*(-\s*)?thank\s*you|thank\s*you.*payment|auto\s*pay|autopay|payment received|online payment|mobile payment|epayment|card payment/i

/** Best guess at what a single column header means. */
export function guessField(header: string): ImportField {
    const h = header.toLowerCase().trim()
    if (h.includes('date')) return 'date'
    if (/bal(ance)?\b|card no|check|slip|account/.test(h)) return 'skip'
    if (/debit|withdraw|money out|paid out|outflow|charge/.test(h)) return 'debit'
    if (/credit|deposit|money in|paid in|inflow/.test(h)) return 'credit'
    if (/amount|amt|value/.test(h)) return 'amount'
    if (/desc|memo|narr|detail|payee|merchant|name|reference|particulars/.test(h)) return 'description'
    if (/category/.test(h)) return 'category'
    if (/type|kind/.test(h)) return 'type'
    return 'skip'
}

/**
 * Guesses all columns together, so that when a bank has two date columns or several
 * description-like columns, the most useful one wins and the rest are skipped.
 */
export function guessFields(headers: string[]): Record<string, ImportField> {
    const map: Record<string, ImportField> = {}
    headers.forEach(h => { map[h] = guessField(h) })

    // Dates: prefer the transaction date over the posting date
    const dateCols = headers.filter(h => map[h] === 'date')
    if (dateCols.length > 1) {
        const best = dateCols.find(h => /trans/i.test(h)) ?? dateCols.find(h => !/post/i.test(h)) ?? dateCols[0]
        dateCols.forEach(h => { if (h !== best) map[h] = 'skip' })
    }

    // Description: prefer an actual description / payee column over memo or details
    const descCols = headers.filter(h => map[h] === 'description')
    if (descCols.length > 1) {
        const rank = (h: string) => /^desc|description|payee|merchant/i.test(h) ? 0 : /name/i.test(h) ? 1 : 2
        const best = [...descCols].sort((a, b) => rank(a) - rank(b))[0]
        descCols.forEach(h => { if (h !== best) map[h] = 'skip' })
    }

    // Only one plain amount, one category and one type column
    for (const field of ['amount', 'category', 'type'] as ImportField[]) {
        headers.filter(h => map[h] === field).slice(1).forEach(h => { map[h] = 'skip' })
    }
    return map
}

export interface NewTransaction {
    date: string
    amount: number
    type: string
    name: string
    note: string
    category_label: string
    category_id: null
}

export interface ReadyRow { row: number; transaction: NewTransaction }

export interface PreparedImport {
    ready: ReadyRow[]
    duplicates: number
    problems: { row: number; reason: string }[]
    categorized: number
    dateOrder: DateOrder
}

function columnFor(mapping: Record<string, ImportField>, field: ImportField): string[] {
    return Object.keys(mapping).filter(col => mapping[col] === field)
}

/**
 * Turns CSV rows into transactions. Pure: everything it needs is passed in, so it can be tested.
 * `existing` are transactions already saved (to skip re-imports); `history` is used to suggest categories.
 */
export function convertRows(
    rows: Record<string, string>[],
    mapping: Record<string, ImportField>,
    spendingSign: SpendingSign,
    existing: { date: string; amount: number; name?: string | null; note?: string | null }[],
    history: PastTransaction[],
): PreparedImport {
    const [dateCol] = columnFor(mapping, 'date')
    const [amountCol] = columnFor(mapping, 'amount')
    const debitCols = columnFor(mapping, 'debit')
    const creditCols = columnFor(mapping, 'credit')
    const descCols = columnFor(mapping, 'description')
    const [typeCol] = columnFor(mapping, 'type')
    const [categoryCol] = columnFor(mapping, 'category')

    const dateOrder = detectDateOrder(rows.map(r => r[dateCol]))
    const guess = buildCategoryGuesser(history)

    // How many of each transaction are already saved. Matching one-for-one means two identical
    // coffees on the same day in the file both import the first time, and neither the second time.
    const alreadySaved = new Map<string, number>()
    for (const t of existing) {
        const k = duplicateKey(t)
        alreadySaved.set(k, (alreadySaved.get(k) ?? 0) + 1)
    }

    const ready: ReadyRow[] = []
    const problems: PreparedImport['problems'] = []
    let duplicates = 0
    let categorized = 0

    rows.forEach((r, i) => {
        const rowNumber = i + 2 // +1 for the header line, +1 to count from 1 like a spreadsheet
        const rawDate = r[dateCol]
        const date = parseDate(rawDate, dateOrder)
        if (!date) { problems.push({ row: rowNumber, reason: `can't read the date "${rawDate ?? ''}"` }); return }

        // Work out amount and direction (money out = expense, money in = income)
        let amount: number | null = null
        let moneyOut = false
        if (amountCol) {
            const a = parseAmount(r[amountCol])
            if (a === null) { problems.push({ row: rowNumber, reason: `can't read the amount "${r[amountCol] ?? ''}"` }); return }
            amount = Math.abs(a)
            moneyOut = spendingSign === 'negative' ? a < 0 : a > 0
        } else {
            const out = debitCols.map(c => parseAmount(r[c])).find(v => v !== null && v !== 0)
            const inn = creditCols.map(c => parseAmount(r[c])).find(v => v !== null && v !== 0)
            if (out != null) { amount = Math.abs(out); moneyOut = true }
            else if (inn != null) { amount = Math.abs(inn); moneyOut = false }
        }
        if (!amount) { problems.push({ row: rowNumber, reason: 'no amount' }); return }

        const description = descCols.map(c => String(r[c] ?? '').trim()).filter(Boolean).join(' · ')
        if (!moneyOut && CARD_PAYMENT.test(description)) {
            problems.push({ row: rowNumber, reason: `"${description}" looks like a credit card payment, not income` })
            return
        }

        let type = moneyOut ? 'expense' : 'income'
        const rawType = typeCol ? String(r[typeCol] ?? '').trim().toLowerCase() : ''
        if (VALID_TYPES.includes(rawType)) type = rawType

        // Category: what you used for this place before, else the bank's category column
        let category = ''
        let usedHistory = false
        const g = guess(description)
        if (g && (g.type === type || (type === 'expense' && (g.type === 'savings' || g.type === 'investment')))) {
            type = g.type
            category = g.category
            usedHistory = true
        } else if (categoryCol) {
            category = String(r[categoryCol] ?? '').trim()
        }

        const transaction: NewTransaction = {
            date, amount: Math.round(amount * 100) / 100, type,
            name: description, note: '', category_label: category, category_id: null,
        }

        const k = duplicateKey(transaction)
        const saved = alreadySaved.get(k) ?? 0
        if (saved > 0) {
            alreadySaved.set(k, saved - 1)
            duplicates++
            return
        }
        if (usedHistory) categorized++
        ready.push({ row: rowNumber, transaction })
    })

    return { ready, duplicates, problems, categorized, dateOrder }
}

/** Reads every row a query returns, past Supabase's 1,000-row limit per request. */
async function fetchAllRows<T>(makeQuery: () => any): Promise<T[]> {
    const PAGE = 1000
    const out: T[] = []
    for (let from = 0; ; from += PAGE) {
        const { data, error } = await makeQuery().range(from, from + PAGE - 1)
        if (error) throw error
        out.push(...(data ?? []))
        if (!data || data.length < PAGE) return out
    }
}

/** Loads what's needed from the database, then converts the rows. */
export async function prepareImport(
    rows: Record<string, string>[],
    mapping: Record<string, ImportField>,
    spendingSign: SpendingSign,
): Promise<PreparedImport> {
    // First pass without the database, just to learn the file's date range
    const firstPass = convertRows(rows, mapping, spendingSign, [], [])
    const dates = firstPass.ready.map(r => r.transaction.date).sort()

    const [existing, history] = await Promise.all([
        dates.length === 0 ? [] : fetchAllRows<any>(() => supabase
            .from('transactions')
            .select('date, amount, type, name, note')
            .gte('date', dates[0])
            .lte('date', dates[dates.length - 1])
            .order('id')),
        supabase
            .from('transactions')
            .select('name, note, category_label, type')
            .neq('category_label', '')
            .not('category_label', 'is', null)
            .order('date', { ascending: false })
            .limit(3000)
            .then(({ data, error }) => { if (error) throw error; return (data ?? []) as PastTransaction[] }),
    ])

    return convertRows(rows, mapping, spendingSign, existing, history)
}
