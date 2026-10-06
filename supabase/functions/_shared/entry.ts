// Helpers for reading what people type or what banks export:
// amounts like "$1,234.50" or "(12.00)", dates like "10/05/2026" or "Oct 5, 2026",
// and merchant names like "SQ *BLUE BOTTLE #1234".

// ---------------------------------------------------------------- amounts

/**
 * Reads an amount the way people and banks write it. Returns null if it isn't a number.
 *   "$1,234.50" -> 1234.5     "-12.00" -> -12     "(12.00)" -> -12
 *   "12.00-"    -> -12        "USD 5"  -> 5       ""        -> null
 */
export function parseAmount(input: unknown): number | null {
    if (typeof input === 'number') return isFinite(input) ? input : null
    if (typeof input !== 'string') return null
    let s = input.trim()
    if (!s) return null
    let negative = false
    if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1) }   // accounting style (12.00)
    if (/-\s*$/.test(s)) { negative = true; s = s.replace(/-\s*$/, '') } // trailing minus 12.00-
    if (/^\s*[^\d.]*-/.test(s)) negative = true                         // -12, -$12, $-12
    s = s.replace(/[^\d.,]/g, '')
    if (!s) return null
    // "1.234,56" (comma decimals) vs "1,234.56"
    const lastComma = s.lastIndexOf(','), lastDot = s.lastIndexOf('.')
    if (lastComma > lastDot && s.length - lastComma - 1 <= 2) {
        s = s.replace(/\./g, '').replace(',', '.')
    } else {
        s = s.replace(/,/g, '')
    }
    if ((s.match(/\./g) || []).length > 1) return null
    const n = parseFloat(s)
    if (!isFinite(n)) return null
    return negative ? -n : n
}

// ---------------------------------------------------------------- dates

const MONTH_NAMES: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
}

function pad(n: number) { return String(n).padStart(2, '0') }

function build(y: number, m: number, d: number): string | null {
    if (y < 100) y += y >= 70 ? 1900 : 2000
    if (m < 1 || m > 12 || d < 1) return null
    if (d > new Date(y, m, 0).getDate()) return null
    if (y < 1970 || y > 2100) return null
    return `${y}-${pad(m)}-${pad(d)}`
}

export type DateOrder = 'MDY' | 'DMY'

/**
 * Looks at a whole column of dates to tell 03/04/2026 (US, March 4) from 03/04/2026 (UK, 3 April).
 * If any first number is over 12 the column must be day-first; otherwise assume US month-first.
 */
export function detectDateOrder(values: unknown[]): DateOrder {
    let dayFirst = false, monthFirst = false
    for (const v of values) {
        const m = String(v ?? '').trim().match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/)
        if (!m) continue
        if (Number(m[1]) > 12) dayFirst = true
        if (Number(m[2]) > 12) monthFirst = true
    }
    return dayFirst && !monthFirst ? 'DMY' : 'MDY'
}

/**
 * Turns a date the way banks and people write it into 'YYYY-MM-DD'. Returns null if it can't.
 * Handles 2026-10-05, 2026/10/05, 20261005, 10/05/2026, 10/5/26, 10-05-2026,
 * Oct 5 2026, Oct 5, 2026, 5 Oct 2026, 05-Oct-2026, and ISO timestamps.
 * Without a year ("10/5"), uses this year.
 */
export function parseDate(input: unknown, order: DateOrder = 'MDY'): string | null {
    if (input instanceof Date) return isNaN(input.getTime()) ? null : build(input.getFullYear(), input.getMonth() + 1, input.getDate())
    const s = String(input ?? '').trim().replace(/\s+/g, ' ')
    if (!s) return null
    let m: RegExpMatchArray | null

    // 2026-10-05, 2026/10/05, 2026.10.05, and timestamps starting with that
    if ((m = s.match(/^(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})(?:$|[T ])/))) return build(+m[1], +m[2], +m[3])
    // 20261005
    if ((m = s.match(/^(\d{4})(\d{2})(\d{2})$/))) return build(+m[1], +m[2], +m[3])
    // 10/05/2026, 10-05-26, 05.10.2026 (optionally followed by a time)
    if ((m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2}|\d{4})(?:$| )/))) {
        const [a, b, y] = [+m[1], +m[2], +m[3]]
        return order === 'DMY' ? build(y, b, a) : build(y, a, b)
    }
    // 10/5 (no year)
    if ((m = s.match(/^(\d{1,2})[\/\-](\d{1,2})$/))) {
        const y = new Date().getFullYear()
        return order === 'DMY' ? build(y, +m[2], +m[1]) : build(y, +m[1], +m[2])
    }
    // Oct 5 2026, Oct 5, 2026, October 05 2026
    if ((m = s.match(/^([A-Za-z]{3,9})\.? (\d{1,2})(?:st|nd|rd|th)?,? (\d{2,4})$/))) {
        const mon = MONTH_NAMES[m[1].toLowerCase().slice(0, m[1].toLowerCase().startsWith('sept') ? 4 : 3)]
        return mon ? build(+m[3], mon, +m[2]) : null
    }
    // 5 Oct 2026, 05-Oct-2026, 05-Oct-26
    if ((m = s.match(/^(\d{1,2})[ \-]([A-Za-z]{3,9})\.?[ \-,]+(\d{2,4})$/))) {
        const mon = MONTH_NAMES[m[2].toLowerCase().slice(0, m[2].toLowerCase().startsWith('sept') ? 4 : 3)]
        return mon ? build(+m[3], mon, +m[1]) : null
    }
    return null
}

export function todayString(offsetDays = 0): string {
    const d = new Date()
    d.setDate(d.getDate() + offsetDays)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// ---------------------------------------------------------------- merchant names

const NOISE_PREFIXES = [
    /^(pos|ach|dda|atm|ppd|web|ccd)\s+/,
    /^(debit|credit) card (purchase|payment)\s*/,
    /^(purchase|payment|recurring payment|preauthorized debit|checkcard|check card)\s*(authorized on \d{1,2}\/\d{1,2}\s*)?/,
    /^(sq|tst|sp|pp|py|paypal|in|dd)\s*\*\s*/,
]

/**
 * A simplified merchant name used to match the same place across transactions:
 *   "SQ *BLUE BOTTLE #1234 OAKLAND CA" and "Blue Bottle" both become "blue bottle".
 */
export function merchantKey(name: unknown): string {
    let s = String(name ?? '').toLowerCase().trim()
    for (const re of NOISE_PREFIXES) s = s.replace(re, '')
    s = s
        .replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g, ' ') // dates
        .replace(/[#*]\s*\w*\d\w*/g, ' ')                 // store numbers like #1234, *AB12
        .replace(/\b\w*\d{3,}\w*\b/g, ' ')               // long reference numbers
        .replace(/\b(ca|ny|tx|fl|wa|or|il|ma|nj|pa|ga|nc|va|az|co|mi|oh|mn|wi|md|tn|in|mo|ut|nv|usa|us)\b\s*$/g, ' ')
        .replace(/[^a-z& ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    return s.split(' ').slice(0, 3).join(' ')
}

export interface PastTransaction {
    name?: string | null
    note?: string | null
    category_label?: string | null
    type: string
    amount?: number
    date?: string
}

/**
 * Learns from past transactions which category and type each merchant usually gets.
 * Returns a lookup: merchant key -> { category, type }.
 */
export function buildCategoryGuesser(history: PastTransaction[]) {
    const counts = new Map<string, Map<string, number>>()
    for (const t of history) {
        if (!t.category_label) continue
        const key = merchantKey(t.name || t.note)
        if (!key) continue
        const label = `${t.type}\u0000${t.category_label}`
        const byLabel = counts.get(key) ?? new Map<string, number>()
        byLabel.set(label, (byLabel.get(label) ?? 0) + 1)
        counts.set(key, byLabel)
    }
    return (name: unknown): { type: string; category: string } | null => {
        const key = merchantKey(name)
        if (!key) return null
        let byLabel = counts.get(key)
        if (!byLabel) {
            // Fall back to the past merchant sharing the most leading words. Two shared words is enough
            // ("blue bottle oakland" ~ "blue bottle coffee"); one is enough only when that's the whole
            // name of one of them ("amazon mktpl" ~ "amazon"), so "whole foods" doesn't match "whole earth".
            const words = key.split(' ')
            let bestShared = 0
            for (const [k, v] of counts) {
                const kWords = k.split(' ')
                let shared = 0
                while (shared < words.length && shared < kWords.length && words[shared] === kWords[shared]) shared++
                const needed = Math.min(2, words.length, kWords.length)
                if (shared >= needed && shared > bestShared && words[0].length >= 3) { bestShared = shared; byLabel = v }
            }
        }
        if (!byLabel) return null
        let best = '', bestCount = 0
        for (const [label, c] of byLabel) if (c > bestCount) { best = label; bestCount = c }
        const [type, category] = best.split('\u0000')
        return { type, category }
    }
}

// ---------------------------------------------------------------- duplicates

/**
 * What makes two transactions "the same" when re-importing a bank file: same date, amount and
 * description. Type is left out on purpose, since you may have re-categorized a row (say, expense to
 * savings) after importing it, and it should still count as already imported.
 */
export function duplicateKey(t: { date: string; amount: number; name?: string | null; note?: string | null }): string {
    const desc = String(t.name || t.note || '').toLowerCase().replace(/\s+/g, ' ').trim()
    return `${String(t.date).slice(0, 10)}|${Math.abs(Number(t.amount)).toFixed(2)}|${desc}`
}

// ---------------------------------------------------------------- card payments

// Paying off a credit card shows up as money coming in on the card's statement,
// but it isn't income, just money moving between your own accounts.
const CARD_PAYMENT = /payment\s*(-\s*)?thank\s*you|thank\s*you.*payment|auto\s*pay|autopay|payment received|online payment|mobile payment|epayment|card payment/i

/** Money arriving on a card statement that is really you paying the card off. */
export function isCardPayment(description: unknown): boolean {
    return CARD_PAYMENT.test(String(description ?? ''))
}

const CARD_ISSUER = /\b(chase|amex|american express|capital one|citi|citibank|discover|barclays|synchrony|bank of america|wells fargo|apple card|goldman sachs|us bank|usaa|navy federal)\b/i
const PAYMENT_WORD = /\b(pmt|payment|autopay|auto pay|e-?payment|epay)\b/i
const CARD_WORD = /\b(credit\s*(card|crd)|card)\b/i

/**
 * Money leaving checking to pay a credit card bill ("CHASE CREDIT CRD AUTOPAY", "AMEX EPAYMENT ACH PMT").
 * When the card itself is also linked, its purchases are already counted, so this payment shouldn't be.
 */
export function isCardBillPayment(description: unknown): boolean {
    const d = String(description ?? '')
    if (!PAYMENT_WORD.test(d)) return false
    return CARD_WORD.test(d) || CARD_ISSUER.test(d)
}

// ---------------------------------------------------------------- refunds

const REFUND = /\brefund|\breversal|credit\s*adj|merchant\s+credit|(?<!tax\s)\breturn\b/i

/** Money coming back from a purchase ("AMAZON.COM REFUND", "PURCHASE RETURN"); not a tax return. */
export function isRefund(description: unknown): boolean {
    return REFUND.test(String(description ?? ''))
}
