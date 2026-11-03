import { Text, Platform } from 'react-native'
import { render, screen, act } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Private, usePrivacy, DEFAULT_HIDDEN_KINDS } from '../Private'

beforeEach(() => usePrivacy.setState({ hidden: false, kinds: DEFAULT_HIDDEN_KINDS, loaded: false }))

const page = () => (
    <Text>
        Balance <Private kind="balances">$5,000.00</Private>, spent <Private kind="totals">$900.00</Private>,
        rent <Private kind="budget">$800.00</Private>, coffee <Private kind="transactions">$4.50</Private>
    </Text>
)

it('shows amounts normally when privacy is off', async () => {
    await render(page())
    expect(screen.getByText(/Balance \$5,000\.00, spent \$900\.00/)).toBeTruthy()
})

it('by default hides balances and totals, and leaves budget and transaction amounts readable', async () => {
    expect(DEFAULT_HIDDEN_KINDS).toEqual(['balances', 'totals'])
    await act(() => usePrivacy.getState().toggle())
    await render(page())
    expect(screen.getByText(/Balance •••••, spent •••••,\s+rent \$800\.00, coffee \$4\.50/)).toBeTruthy()
})

it('hides whatever you choose', async () => {
    await act(() => usePrivacy.getState().toggle())
    await act(() => usePrivacy.getState().setKind('transactions', true))
    await act(() => usePrivacy.getState().setKind('balances', false))
    await render(page())
    expect(screen.getByText(/Balance \$5,000\.00, spent •••••,\s+rent \$800\.00, coffee •••••/)).toBeTruthy()
})

it('on the web, keeps the amount but marks it to be blurred until pointed at or tapped', async () => {
    const os = Platform.OS
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
    try {
        await act(() => usePrivacy.getState().toggle())
        await render(<Text>Spent <Private kind="totals">$1,234.50</Private></Text>)
        const amount = screen.getByText('$1,234.50')
        expect(amount.props.dataSet).toEqual({ private: 'on' })
        expect(amount.props.focusable).toBe(true)
    } finally {
        Object.defineProperty(Platform, 'OS', { value: os, configurable: true })
    }
})

it('remembers whether it is on, and what to hide, on this device', async () => {
    await act(() => usePrivacy.getState().toggle())
    await act(() => usePrivacy.getState().setKind('budget', true))
    usePrivacy.setState({ hidden: false, kinds: DEFAULT_HIDDEN_KINDS, loaded: false })
    await act(() => usePrivacy.getState().load())
    expect(usePrivacy.getState().hidden).toBe(true)
    expect([...usePrivacy.getState().kinds].sort()).toEqual(['balances', 'budget', 'totals'])
})

it('reads the older saved setting ("on") too', async () => {
    await AsyncStorage.setItem('privacy', 'on')
    await act(() => usePrivacy.getState().load())
    expect(usePrivacy.getState().hidden).toBe(true)
    expect(usePrivacy.getState().kinds).toEqual(DEFAULT_HIDDEN_KINDS)
})
