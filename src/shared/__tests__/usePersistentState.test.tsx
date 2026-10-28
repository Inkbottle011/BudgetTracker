import { renderHook, act, waitFor } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { usePersistentState } from '../usePersistentState'

beforeEach(() => AsyncStorage.clear())

it('starts with the default, saves changes, and reads them back next time', async () => {
    const first = await renderHook(() => usePersistentState('budgetLayout', 'simple', ['simple', 'months']))
    expect(first.result.current[0]).toBe('simple')
    await act(() => first.result.current[1]('months'))
    expect(first.result.current[0]).toBe('months')
    expect(await AsyncStorage.getItem('budgetLayout')).toBe('"months"')

    const again = await renderHook(() => usePersistentState('budgetLayout', 'simple', ['simple', 'months']))
    await waitFor(() => expect(again.result.current[0]).toBe('months'))
})

it('ignores a saved value it does not recognise', async () => {
    await AsyncStorage.setItem('budgetLayout', '"sideways"')
    const { result } = await renderHook(() => usePersistentState('budgetLayout', 'simple', ['simple', 'months']))
    await act(async () => {})
    expect(result.current[0]).toBe('simple')
})
