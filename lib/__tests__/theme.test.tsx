import { Text, TouchableOpacity } from 'react-native'
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as RN from 'react-native'
import { ThemeProvider, useTheme, light, dark, typeColors, APPEARANCE_KEY } from '../theme'

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
