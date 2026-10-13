import { render, screen } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { ThemeProvider } from '../../lib/theme'
import { SpaceBackground } from '../SpaceBackground'

beforeEach(async () => { await AsyncStorage.clear() })

it('draws a sky behind the app that never gets in the way of taps', async () => {
    await render(<ThemeProvider><SpaceBackground /></ThemeProvider>)
    const sky = await screen.findByTestId('space-background', { includeHiddenElements: true })
    expect(sky.props.pointerEvents).toBe('none')
    expect(sky.props.accessibilityElementsHidden ?? sky.props['aria-hidden']).toBeTruthy()
})

it('draws nothing when turned off', async () => {
    await AsyncStorage.setItem('background', JSON.stringify({ scene: 'off' }))
    await render(<ThemeProvider><SpaceBackground /></ThemeProvider>)
    await new Promise(r => setTimeout(r, 0))
    expect(screen.queryByTestId('space-background', { includeHiddenElements: true })).toBeNull()
})
