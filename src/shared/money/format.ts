/** "$1,234.50", "-$270.00"; with sign: "+$270.00"; without cents: "$1,235". */
export function formatMoney(n: number, opts: { sign?: boolean; cents?: boolean } = {}): string {
    const cents = opts.cents !== false
    const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 })
    const rounded = cents ? Math.round(n * 100) : Math.round(n)
    const prefix = rounded < 0 ? '-' : opts.sign && rounded > 0 ? '+' : ''
    return `${prefix}$${abs}`
}
