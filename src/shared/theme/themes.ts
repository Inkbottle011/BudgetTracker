// The color themes you can pick in Settings. Each has a light and a dark version.
// Money keeps its meaning in every theme: green for money in, red for money out, violet for savings.
// To add a theme: copy one below, change its colors, and add it to THEME_LIST.
import type { Tint } from './background'

export type ThemeId = 'nightSky' | 'ocean' | 'forest' | 'sunset' | 'classic'

/** The parts that change from theme to theme. */
interface ThemeColors {
    page: string; surface: string; surfaceAlt: string        // backgrounds
    ink: string; text: string; muted: string; faint: string  // text, strongest to faintest
    line: string; track: string                              // borders, empty part of bars
    primary: string; onPrimary: string; primarySoft: string  // buttons, links, selected things
    panel: string; onPanelMuted: string                      // the summary panel on the dashboard
    bar: string; onBarMuted: string; barLine: string         // the top bar and the tab bar
    paceMark: string                                         // budget bars that are on track
}

// The same in every theme (only light vs dark differs)
const MONEY = {
    light: {
        good: '#12804c', goodSoft: '#e2f5ea',       // money in, under budget (text)
        bad: '#c2382c', badSoft: '#fdebe9',         // money out, over budget (text)
        warn: '#9a5b00', warnSoft: '#fdf1d8',       // getting close to a limit (text)
        saved: '#6340d6', savedSoft: '#eeeafd',     // savings (text)
        // Bars and chart marks, brighter than text; checked for color-blind separation
        incomeMark: '#22b06b', spendMark: '#d2402f', savedMark: '#7c5cf0', warnMark: '#e89a1c',
    },
    dark: {
        good: '#62dc9f', goodSoft: '#12342a',
        bad: '#ff8f82', badSoft: '#3d1d22',
        warn: '#f5bd59', warnSoft: '#3a2c12',
        saved: '#bba8ff', savedSoft: '#2a2352',
        incomeMark: '#26ad6c', spendMark: '#cc3d31', savedMark: '#8a6ff0', warnMark: '#d98d1a',
    },
}

function palette(mode: 'light' | 'dark', t: ThemeColors) {
    return {
        mode,
        ...t,
        onPanel: '#ffffff',
        onBar: '#ffffff',
        ...MONEY[mode],
        move: mode === 'light' ? '#76809a' : '#8e98b5',   // transfers between your own accounts
        shadow: '#000000',
        scrim: mode === 'light' ? 'rgba(10,14,40,0.4)' : 'rgba(0,0,0,0.6)',   // dims the page behind menus
    }
}

export type Palette = ReturnType<typeof palette>

export interface Theme {
    id: ThemeId
    name: string
    tint: Tint              // the moving background's color for this theme
    light: Palette
    dark: Palette
}

const nightSky: Theme = {
    id: 'nightSky', name: 'Night sky', tint: 'blue',
    light: palette('light', {
        page: '#f1f3fa', surface: '#ffffff', surfaceAlt: '#f4f6fc',
        ink: '#18213d', text: '#2d3854', muted: '#5f6b88', faint: '#939cb6',
        line: '#e1e5f2', track: '#e8ebf6',
        primary: '#3654d1', onPrimary: '#ffffff', primarySoft: '#e8ecfc',
        panel: '#202a6e', onPanelMuted: '#b8c0ef',
        bar: '#1b2360', onBarMuted: '#aab3e6', barLine: '#2a3478',
        paceMark: '#3654d1',
    }),
    dark: palette('dark', {
        page: '#0b0f1f', surface: '#141a30', surfaceAlt: '#1a2240',
        ink: '#edf0fa', text: '#cdd4ea', muted: '#9aa4c3', faint: '#6b7598',
        line: '#262f52', track: '#232c4b',
        primary: '#8ea6ff', onPrimary: '#0b0f1f', primarySoft: '#1f2a57',
        panel: '#1f2a66', onPanelMuted: '#b3bbea',
        bar: '#10152e', onBarMuted: '#8e98c4', barLine: '#222b52',
        paceMark: '#6f8cf5',
    }),
}

const ocean: Theme = {
    id: 'ocean', name: 'Ocean', tint: 'teal',
    light: palette('light', {
        page: '#eef5f7', surface: '#ffffff', surfaceAlt: '#f2f8fa',
        ink: '#10303a', text: '#2a4651', muted: '#557480', faint: '#8fa9b2',
        line: '#dce9ed', track: '#e3eef1',
        primary: '#0a7a8f', onPrimary: '#ffffff', primarySoft: '#dff2f5',
        panel: '#0d4f63', onPanelMuted: '#b3dbe4',
        bar: '#0b4256', onBarMuted: '#9fcbd6', barLine: '#16566b',
        paceMark: '#0f8ea5',
    }),
    dark: palette('dark', {
        page: '#081419', surface: '#0f2029', surfaceAlt: '#142a35',
        ink: '#e8f4f7', text: '#c9dfe5', muted: '#93b0ba', faint: '#62808a',
        line: '#1f3743', track: '#1b313c',
        primary: '#4fcfe0', onPrimary: '#081419', primarySoft: '#123a45',
        panel: '#0f3a4a', onPanelMuted: '#a3cbd5',
        bar: '#071c24', onBarMuted: '#7fa8b4', barLine: '#163440',
        paceMark: '#2fb3c8',
    }),
}

const forest: Theme = {
    id: 'forest', name: 'Forest', tint: 'green',
    light: palette('light', {
        page: '#f2f5f0', surface: '#ffffff', surfaceAlt: '#f5f8f3',
        ink: '#1b2e24', text: '#2f4538', muted: '#5c7364', faint: '#93a699',
        line: '#dfe7db', track: '#e7ede3',
        // A warm wood accent, so buttons never look like money-in green
        primary: '#9a5a26', onPrimary: '#ffffff', primarySoft: '#f6ece2',
        panel: '#24493a', onPanelMuted: '#b9d3c3',
        bar: '#1e3b2e', onBarMuted: '#a9c6b5', barLine: '#2c4d3d',
        paceMark: '#b06a30',
    }),
    dark: palette('dark', {
        page: '#0b130f', surface: '#121d17', surfaceAlt: '#17241d',
        ink: '#ebf2ec', text: '#cddcd2', muted: '#97ad9e', faint: '#68806f',
        line: '#22362b', track: '#1e3026',
        primary: '#e3a466', onPrimary: '#0b130f', primarySoft: '#3a2a1a',
        panel: '#1d3a2e', onPanelMuted: '#a7c4b3',
        bar: '#0d1a13', onBarMuted: '#8eab99', barLine: '#1f3428',
        paceMark: '#cf8f4f',
    }),
}

const sunset: Theme = {
    id: 'sunset', name: 'Sunset', tint: 'rose',
    light: palette('light', {
        page: '#fbf3f0', surface: '#ffffff', surfaceAlt: '#fdf6f3',
        ink: '#2e1a2b', text: '#4a3046', muted: '#7a6074', faint: '#ad97a7',
        line: '#f0e1dc', track: '#f4e8e4',
        // Orange, not red, so buttons never look like money-out red
        primary: '#c75a12', onPrimary: '#ffffff', primarySoft: '#fdeadc',
        panel: '#552a5c', onPanelMuted: '#e3c4dc',
        bar: '#47204f', onBarMuted: '#d6b3cf', barLine: '#5a2d63',
        paceMark: '#e07a2e',
    }),
    dark: palette('dark', {
        page: '#140c14', surface: '#1e1420', surfaceAlt: '#261a28',
        ink: '#f6ecf2', text: '#e2cfdc', muted: '#b49caf', faint: '#7f6a7c',
        line: '#352638', track: '#2e2131',
        primary: '#ffa060', onPrimary: '#140c14', primarySoft: '#41261a',
        panel: '#3d1e45', onPanelMuted: '#d2b3cb',
        bar: '#1f0f24', onBarMuted: '#bb9bb5', barLine: '#3a2240',
        paceMark: '#f08a45',
    }),
}

const classic: Theme = {
    id: 'classic', name: 'Classic', tint: 'blue',
    light: palette('light', {
        page: '#f3f5f7', surface: '#ffffff', surfaceAlt: '#f6f8fa',
        ink: '#1d2b3a', text: '#334252', muted: '#6a7889', faint: '#97a3af',
        line: '#e4e9ee', track: '#edf0f3',
        primary: '#2f6f9f', onPrimary: '#ffffff', primarySoft: '#e7f0f7',
        panel: '#22344a', onPanelMuted: '#b8c4d1',
        bar: '#22344a', onBarMuted: '#b0bccb', barLine: '#2e4259',
        paceMark: '#2f6f9f',
    }),
    dark: palette('dark', {
        page: '#0f1720', surface: '#18222d', surfaceAlt: '#1f2b37',
        ink: '#e9eef3', text: '#c9d3dc', muted: '#98a6b4', faint: '#6c7b8a',
        line: '#2a3745', track: '#263341',
        primary: '#6cb0e4', onPrimary: '#0f1720', primarySoft: '#1c3346',
        panel: '#1f3550', onPanelMuted: '#a9bbcc',
        bar: '#131c26', onBarMuted: '#8d9cab', barLine: '#253241',
        paceMark: '#5a9fd4',
    }),
}

export const THEMES: Record<ThemeId, Theme> = { nightSky, ocean, forest, sunset, classic }
export const THEME_LIST: Theme[] = [nightSky, ocean, forest, sunset, classic]
export const DEFAULT_THEME: ThemeId = 'nightSky'

export const isThemeId = (v: unknown): v is ThemeId => typeof v === 'string' && v in THEMES
