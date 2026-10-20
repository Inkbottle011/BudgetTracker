// Dashboard helpers: number formatting.
// Colors come from the app theme (lib/theme.tsx), so the dashboard follows light and dark mode.
export type { Palette } from '../../../shared/theme/theme'

/** Numbers line up in columns */
export const tabular = { fontVariant: ['tabular-nums'] as any }

export const money = (n: number) =>
    `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Whole dollars, for big headline numbers and compact labels */
export const dollars = (n: number) =>
    `${n < 0 ? '-' : ''}$${Math.round(Math.abs(n)).toLocaleString('en-US')}`
