import { Text, Platform } from 'react-native'
import { render, screen, act } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Private, usePrivacy } from '../Private'

beforeEach(() => usePrivacy.setState({ hidden: false, loaded: false }))

it('shows amounts normally when privacy is off', async () => {
    await render(<Text>Spent <Private>$1,234.50</Private> this month</Text>)
    expect(screen.getByText('Spent $1,234.50 this month')).toBeTruthy()
})

it('on a phone, hides amounts as dots when privacy is on', async () => {
    await act(() => usePrivacy.getState().toggle())
    await render(<Text>Spent <Private>$1,234.50</Private> this month</Text>)
    expect(screen.getByText('Spent ••••• this month')).toBeTruthy()
    expect(screen.queryByText(/1,234/)).toBeNull()
})

it('on the web, keeps the amount but marks it to be blurred until pointed at or tapped', async () => {
    const os = Platform.OS
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
    try {
        await act(() => usePrivacy.getState().toggle())
        await render(<Text>Spent <Private>$1,234.50</Private></Text>)
        const amount = screen.getByText('$1,234.50')
        expect(amount.props.dataSet).toEqual({ private: 'on' })
        expect(amount.props.focusable).toBe(true)
    } finally {
        Object.defineProperty(Platform, 'OS', { value: os, configurable: true })
    }
})

it('remembers the choice on this device', async () => {
    await act(() => usePrivacy.getState().toggle())
    expect(await AsyncStorage.getItem('privacy')).toBe('on')
    usePrivacy.setState({ hidden: false, loaded: false })
    await act(() => usePrivacy.getState().load())
    expect(usePrivacy.getState().hidden).toBe(true)
})
