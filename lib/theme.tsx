// Colors for the whole app, in light and dark. To change how the app looks, change the values here.
// Every screen reads its colors from useTheme(), so nothing else needs editing.
import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react'
import { useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

export const light = {
    page: '#f3f5f7',        // behind everything
    surface: '#ffffff',     // sections, cards, sheets
    surfaceAlt: '#f6f8fa',  // inputs, hovered/selected rows
    ink: '#1d2b3a',         // headings, numbers, main text
    text: '#334252',        // body text
    muted: '#6a7889',       // secondary text
    faint: '#97a3af',       // hints, placeholders
    line: '#e4e9ee',        // dividers and borders
    track: '#edf0f3',       // empty part of bars, switches
    primary: '#2f6f9f',     // buttons, links, selected things
    onPrimary: '#ffffff',
    primarySoft: '#e7f0f7',
    panel: '#22344a',       // the dark summary panel
    onPanel: '#ffffff',
    onPanelMuted: '#b8c4d1',
    good: '#1f7a4d',
    goodSoft: '#e7f4ec',
    bad: '#b8392f',
    badSoft: '#fbecea',
    warn: '#9a6400',
    warnSoft: '#fdf3dc',
    move: '#7b8794',        // transfers between your own accounts
    shadow: '#000000',
    scrim: 'rgba(0,0,0,0.35)',  // dims the page behind menus and sheets
}

export type Palette = typeof light

export const dark: Palette = {
    page: '#0f1720',
    surface: '#18222d',
    surfaceAlt: '#1f2b37',
    ink: '#e9eef3',
    text: '#c9d3dc',
    muted: '#98a6b4',
    faint: '#6c7b8a',
    line: '#2a3745',
    track: '#263341',
    primary: '#6cb0e4',
    onPrimary: '#0f1720',
    primarySoft: '#1c3346',
    panel: '#1f3550',
    onPanel: '#ffffff',
    onPanelMuted: '#a9bbcc',
    good: '#5fd39a',
    goodSoft: '#16352a',
    bad: '#ff8f80',
    badSoft: '#3d2020',
    warn: '#f2b955',
    warnSoft: '#3b2e12',
    move: '#8f9cab',
    shadow: '#000000',
    scrim: 'rgba(0,0,0,0.6)',
}

const TYPE_HUES: Record<string, { light: [string, string]; dark: [string, string] }> = {
    // [text, background]
    income:        { light: ['#1f6a9a', '#e6f0f8'], dark: ['#8cc6f2', '#1b3346'] },
    expense:       { light: ['#b0392f', '#fbecea'], dark: ['#ff9d90', '#3d2020'] },
    savings:       { light: ['#1f7a4d', '#e7f4ec'], dark: ['#6fdba5', '#16352a'] },
    investment:    { light: ['#7046a3', '#f1ebf8'], dark: ['#c6a6ef', '#2e2440'] },
    reimbursement: { light: ['#13786f', '#e3f4f2'], dark: ['#6fd8cc', '#14332f'] },
    withdrawal:    { light: ['#9a6400', '#fdf3dc'], dark: ['#f2b955', '#3b2e12'] },
    transfer:      { light: ['#5d6b79', '#eef1f4'], dark: ['#a7b3bf', '#26313c'] },
}

/** Badge colors for a transaction type ("expense", "income", …). */
export function typeColors(type: string, p: Palette): { fg: string; bg: string } {
    const hue = TYPE_HUES[type.toLowerCase()] ?? TYPE_HUES.transfer
    const [fg, bg] = p === dark ? hue.dark : hue.light
    return { fg, bg }
}

export type Preference = 'system' | 'light' | 'dark'
export const APPEARANCE_KEY = 'appearance'

interface ThemeValue {
    c: Palette
    scheme: 'light' | 'dark'
    preference: Preference
    setPreference: (p: Preference) => void
}

const ThemeContext = createContext<ThemeValue>({ c: light, scheme: 'light', preference: 'system', setPreference: () => {} })

/** Light or dark: follows the device unless you pick one in Settings. Your choice is remembered. */
export function ThemeProvider({ children }: { children: ReactNode }) {
    const device = useColorScheme()
    const [preference, setPref] = useState<Preference>('system')

    useEffect(() => {
        AsyncStorage.getItem(APPEARANCE_KEY)
            .then(v => { if (v === 'light' || v === 'dark' || v === 'system') setPref(v) })
            .catch(() => {})
    }, [])

    const value = useMemo<ThemeValue>(() => {
        const scheme = preference === 'system' ? (device === 'dark' ? 'dark' : 'light') : preference
        return {
            c: scheme === 'dark' ? dark : light,
            scheme,
            preference,
            setPreference: (p: Preference) => {
                setPref(p)
                AsyncStorage.setItem(APPEARANCE_KEY, p).catch(() => {})
            },
        }
    }, [preference, device])

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)

/**
 * Styles that depend on the theme, rebuilt only when the theme changes:
 * `const makeStyles = (c: Palette) => StyleSheet.create({ box: { backgroundColor: c.surface } })`
 * then `const styles = useStyles(makeStyles)` inside the component.
 */
export function useStyles<T>(factory: (c: Palette) => T): T {
    const { c } = useTheme()
    return useMemo(() => factory(c), [c])
}

/** Numbers line up in columns */
export const tabular = { fontVariant: ['tabular-nums'] as any }
