import { Text, TouchableOpacity } from 'react-native'
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as RN from 'react-native'
import { ThemeProvider, useTheme, light, dark, typeColors, APPEARANCE_KEY, COLOR_THEME_KEY } from '../theme'
import { THEMES } from '../themes'
import { BACKGROUND_KEY } from '../background'

function Probe() {
    const { c, scheme, preference, setPreference } = useTheme()
    return (
        <>
            <Text>{`${scheme}:${preference}:${c.page}`}</Text>
            <TouchableOpacity onPress={() => setPreference('dark')}><Text>go dark</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setPreference('system')}><Text>follow device</Text></TouchableOpacity>
        </>
    )
}

let deviceScheme: 'light' | 'dark' = 'light'
beforeEach(async () => {
    deviceScheme = 'light'
    jest.spyOn(RN, 'useColorScheme').mockImplementation(() => deviceScheme)
    await AsyncStorage.clear()
})
afterEach(() => jest.restoreAllMocks())

it('is light outside a provider, so components work on their own (and in tests)', async () => {
    await render(<Probe />)
    expect(screen.getByText(`light:system:${light.page}`)).toBeTruthy()
})

it('follows the device by default', async () => {
    deviceScheme = 'dark'
    await render(<ThemeProvider><Probe /></ThemeProvider>)
    expect(await screen.findByText(`dark:system:${dark.page}`)).toBeTruthy()
})

it('can be set to dark, and remembers it', async () => {
    await render(<ThemeProvider><Probe /></ThemeProvider>)
    await fireEvent.press(screen.getByText('go dark'))
    expect(screen.getByText(`dark:dark:${dark.page}`)).toBeTruthy()
    await waitFor(async () => expect(await AsyncStorage.getItem(APPEARANCE_KEY)).toBe('dark'))
})

it('uses the remembered choice next time', async () => {
    await AsyncStorage.setItem(APPEARANCE_KEY, 'dark')
    await render(<ThemeProvider><Probe /></ThemeProvider>)
    expect(await screen.findByText(`dark:dark:${dark.page}`)).toBeTruthy()
})

it('ignores a broken saved value', async () => {
    await AsyncStorage.setItem(APPEARANCE_KEY, 'purple')
    await render(<ThemeProvider><Probe /></ThemeProvider>)
    expect(await screen.findByText(`light:system:${light.page}`)).toBeTruthy()
})

it('every color exists in both themes, and each transaction type has readable colors', () => {
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort())
    for (const t of ['income', 'expense', 'savings', 'investment', 'reimbursement', 'withdrawal', 'transfer']) {
        for (const p of [light, dark]) {
            const tc = typeColors(t, p)
            expect(tc.fg).toMatch(/^#/)
            expect(tc.bg).toMatch(/^#/)
        }
    }
})

describe('moving background', () => {
    function BgProbe() {
        const { background, setBackground, backdrop } = useTheme()
        return (
            <>
                <Text>{`${background.scene}:${background.tint}:${backdrop}`}</Text>
                <TouchableOpacity onPress={() => setBackground({ scene: 'warp', tint: 'rose' })}><Text>warp</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setBackground({ scene: 'off' })}><Text>off</Text></TouchableOpacity>
            </>
        )
    }

    it('starts on, so pages are see-through and the sky shows behind them', async () => {
        await render(<ThemeProvider><BgProbe /></ThemeProvider>)
        expect(await screen.findByText('stars:blue:transparent')).toBeTruthy()
    })

    it('can be changed or turned off, and remembers it', async () => {
        await render(<ThemeProvider><BgProbe /></ThemeProvider>)
        await fireEvent.press(screen.getByText('warp'))
        expect(screen.getByText('warp:rose:transparent')).toBeTruthy()
        await fireEvent.press(screen.getByText('off'))
        expect(screen.getByText(`off:rose:${light.page}`)).toBeTruthy()
        await waitFor(async () => expect(JSON.parse((await AsyncStorage.getItem(BACKGROUND_KEY))!)).toMatchObject({ scene: 'off', tint: 'rose' }))
    })

    it('uses the remembered background next time', async () => {
        await AsyncStorage.setItem(BACKGROUND_KEY, JSON.stringify({ scene: 'nebula', tint: 'teal' }))
        await render(<ThemeProvider><BgProbe /></ThemeProvider>)
        expect(await screen.findByText('nebula:teal:transparent')).toBeTruthy()
    })

    it('keeps the plain page color outside a provider', async () => {
        await render(<BgProbe />)
        expect(screen.getByText(`off:blue:${light.page}`)).toBeTruthy()
    })
})

describe('color themes', () => {
    function ThemeProbe() {
        const { c, themeId, setThemeId, background } = useTheme()
        return (
            <>
                <Text>{`${themeId}:${c.primary}:${c.bar}:${background.tint}`}</Text>
                <TouchableOpacity onPress={() => setThemeId('forest')}><Text>forest</Text></TouchableOpacity>
            </>
        )
    }

    it('starts on Night sky', async () => {
        await render(<ThemeProvider><ThemeProbe /></ThemeProvider>)
        expect(await screen.findByText(`nightSky:${THEMES.nightSky.light.primary}:${THEMES.nightSky.light.bar}:blue`)).toBeTruthy()
    })

    it('switching theme recolors the app, matches the moving background, and is remembered', async () => {
        await render(<ThemeProvider><ThemeProbe /></ThemeProvider>)
        await fireEvent.press(screen.getByText('forest'))
        expect(screen.getByText(`forest:${THEMES.forest.light.primary}:${THEMES.forest.light.bar}:green`)).toBeTruthy()
        await waitFor(async () => expect(await AsyncStorage.getItem(COLOR_THEME_KEY)).toBe('forest'))
    })

    it('uses the remembered theme, and ignores a broken one', async () => {
        await AsyncStorage.setItem(COLOR_THEME_KEY, 'sunset')
        const first = await render(<ThemeProvider><ThemeProbe /></ThemeProvider>)
        expect(await screen.findByText(new RegExp(`^sunset:${THEMES.sunset.light.primary}`))).toBeTruthy()
        first.unmount()
        await AsyncStorage.setItem(COLOR_THEME_KEY, 'neon')
        await render(<ThemeProvider><ThemeProbe /></ThemeProvider>)
        expect(await screen.findByText(/^nightSky:/)).toBeTruthy()
    })

    it('every theme has every color in light and dark, and keeps money colors recognizable', () => {
        for (const id of Object.keys(THEMES) as (keyof typeof THEMES)[]) {
            for (const mode of ['light', 'dark'] as const) {
                const p = THEMES[id][mode]
                expect(Object.keys(p).sort()).toEqual(Object.keys(light).sort())
                expect(p.mode).toBe(mode)
                // Green in, red out, violet saved, whatever the theme
                expect(hue(p.incomeMark)).toBeGreaterThan(90); expect(hue(p.incomeMark)).toBeLessThan(170)
                expect(hue(p.spendMark) < 20 || hue(p.spendMark) > 340).toBe(true)
                expect(hue(p.savedMark)).toBeGreaterThan(240); expect(hue(p.savedMark)).toBeLessThan(290)
                // Transaction badges pick the right mode
                expect(typeColors('income', p).fg).toBe(typeColors('income', mode === 'dark' ? dark : light).fg)
            }
        }
    })
})

/** Hue in degrees of a #rrggbb color */
function hue(hex: string) {
    const n = parseInt(hex.slice(1), 16)
    const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
    if (!d) return 0
    const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
    return (h * 60 + 360) % 360
}
