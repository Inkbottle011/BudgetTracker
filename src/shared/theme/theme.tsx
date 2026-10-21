// Colors for the whole app, in light and dark. To change how the app looks, change the values here.
// Every screen reads its colors from useTheme(), so nothing else needs editing.
import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react'
import { useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { BACKGROUND_KEY, BackgroundSettings, DEFAULT_BACKGROUND, parseBackground } from './background'
import { THEMES, DEFAULT_THEME, isThemeId, type Palette, type ThemeId } from './themes'

// The default theme (Night sky). Other themes are in lib/themes.ts.
export const light: Palette = THEMES.nightSky.light
export const dark: Palette = THEMES.nightSky.dark
export type { Palette }

const TYPE_HUES: Record<string, { light: [string, string]; dark: [string, string] }> = {
    // [text, background]
    income:        { light: ['#12804c', '#e2f5ea'], dark: ['#6fe3a8', '#12342a'] },
    expense:       { light: ['#c2382c', '#fdebe9'], dark: ['#ff9d90', '#3d1d22'] },
    savings:       { light: ['#6340d6', '#eeeafd'], dark: ['#c4b2ff', '#2a2352'] },
    investment:    { light: ['#3654d1', '#e8ecfc'], dark: ['#a3b6ff', '#1f2a57'] },
    reimbursement: { light: ['#0f7a73', '#e0f4f2'], dark: ['#6fd8cc', '#13332f'] },
    withdrawal:    { light: ['#9a5b00', '#fdf1d8'], dark: ['#f5bd59', '#3a2c12'] },
    transfer:      { light: ['#5a6582', '#eceff7'], dark: ['#a9b2cc', '#232c48'] },
}

/** Badge colors for a transaction type ("expense", "income", …). */
export function typeColors(type: string, p: Palette): { fg: string; bg: string } {
    const hue = TYPE_HUES[type.toLowerCase()] ?? TYPE_HUES.transfer
    const [fg, bg] = p.mode === 'dark' ? hue.dark : hue.light
    return { fg, bg }
}

export type Preference = 'system' | 'light' | 'dark'
export const APPEARANCE_KEY = 'appearance'
export const COLOR_THEME_KEY = 'colorTheme'

interface ThemeValue {
    c: Palette
    scheme: 'light' | 'dark'
    preference: Preference
    setPreference: (p: Preference) => void
    /** The moving space background chosen in Settings */
    background: BackgroundSettings
    setBackground: (change: Partial<BackgroundSettings>) => void
    /** Behind each page: see-through when the moving background is on, so it shows; otherwise c.page */
    backdrop: string
    /** The color theme chosen in Settings (Night sky, Ocean, …) */
    themeId: ThemeId
    setThemeId: (id: ThemeId) => void
}

const ThemeContext = createContext<ThemeValue>({
    c: light, scheme: 'light', preference: 'system', setPreference: () => {},
    background: { ...DEFAULT_BACKGROUND, scene: 'off' }, setBackground: () => {}, backdrop: light.page,
    themeId: DEFAULT_THEME, setThemeId: () => {},
})

/** Light or dark: follows the device unless you pick one in Settings. Your choice is remembered. */
export function ThemeProvider({ children }: { children: ReactNode }) {
    const device = useColorScheme()
    const [preference, setPref] = useState<Preference>('system')
    const [background, setBg] = useState<BackgroundSettings>(DEFAULT_BACKGROUND)
    const [themeId, setTheme] = useState<ThemeId>(DEFAULT_THEME)

    useEffect(() => {
        AsyncStorage.getItem(APPEARANCE_KEY)
            .then(v => { if (v === 'light' || v === 'dark' || v === 'system') setPref(v) })
            .catch(() => {})
        AsyncStorage.getItem(COLOR_THEME_KEY)
            .then(v => { if (isThemeId(v)) setTheme(v) })
            .catch(() => {})
        AsyncStorage.getItem(BACKGROUND_KEY)
            .then(v => { if (v) setBg(parseBackground(v)) })
            .catch(() => {})
    }, [])

    const value = useMemo<ThemeValue>(() => {
        const scheme = preference === 'system' ? (device === 'dark' ? 'dark' : 'light') : preference
        const c = THEMES[themeId][scheme === 'dark' ? 'dark' : 'light']
        return {
            c,
            scheme,
            preference,
            setPreference: (p: Preference) => {
                setPref(p)
                AsyncStorage.setItem(APPEARANCE_KEY, p).catch(() => {})
            },
            background,
            setBackground: (change: Partial<BackgroundSettings>) => {
                setBg(prev => {
                    const next = { ...prev, ...change }
                    AsyncStorage.setItem(BACKGROUND_KEY, JSON.stringify(next)).catch(() => {})
                    return next
                })
            },
            backdrop: background.scene === 'off' ? c.page : 'transparent',
            themeId,
            setThemeId: (id: ThemeId) => {
                setTheme(id)
                AsyncStorage.setItem(COLOR_THEME_KEY, id).catch(() => {})
                // The moving background takes on the theme's color (it can still be changed after)
                setBg(prev => {
                    const next = { ...prev, tint: THEMES[id].tint }
                    AsyncStorage.setItem(BACKGROUND_KEY, JSON.stringify(next)).catch(() => {})
                    return next
                })
            },
        }
    }, [preference, device, background, themeId])

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
