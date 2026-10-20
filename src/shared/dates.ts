// Dates as plain 'YYYY-MM-DD' strings, so time zones can't shift them. Used across the app.

function pad(n: number) { return String(n).padStart(2, '0') }

export function toDateString(d: Date): string {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Today's date where the user is (not UTC). */
export function localToday(): string {
    return toDateString(new Date())
}

export function addDays(date: string, days: number): string {
    const [y, m, d] = date.split('-').map(Number)
    return toDateString(new Date(y, m - 1, d + days))
}

export function daysInMonth(year: number, month0: number) {
    return new Date(year, month0 + 1, 0).getDate()
}

export function isValidDate(s: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
    const [y, m, d] = s.split('-').map(Number)
    return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m - 1)
}
