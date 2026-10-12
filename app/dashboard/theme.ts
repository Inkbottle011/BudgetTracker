// Dashboard look: one dark summary panel, everything else white sections on a pale page.
export const C = {
    page: '#f3f5f7',
    surface: '#ffffff',
    ink: '#1d2b3a',        // headings and numbers
    panel: '#22344a',      // the summary panel
    muted: '#6a7889',      // secondary text
    faint: '#9aa5b1',
    line: '#e4e9ee',
    track: '#edf0f3',      // empty part of bars
    good: '#1f7a4d',
    bad: '#b8392f',
    plan: '#2f6f9f',       // planned / savings
    move: '#7b8794',       // transfers
}

/** Numbers line up in columns */
export const tabular = { fontVariant: ['tabular-nums'] as any }

export const money = (n: number) =>
    `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Whole dollars, for big headline numbers and compact labels */
export const dollars = (n: number) =>
    `${n < 0 ? '-' : ''}$${Math.round(Math.abs(n)).toLocaleString('en-US')}`
