import { useState } from 'react'
import { Text } from 'react-native'
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react-native'
import { ErrorBoundary } from '../ErrorBoundary'
import { DateField } from '../DateField'
import { useToast } from '../useToast'

describe('ErrorBoundary', () => {
    function Bomb(): any { throw new Error('Kaboom') }

    it('shows a friendly message instead of a blank screen, and can try again', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {})
        function Toggle() {
            const [broken, setBroken] = useState(true)
            return (
                <>
                    <Text onPress={() => setBroken(false)}>fix it</Text>
                    <ErrorBoundary>{broken ? <Bomb /> : <Text>All good</Text>}</ErrorBoundary>
                </>
            )
        }
        await render(<Toggle />)
        expect(screen.getByText('Something went wrong')).toBeTruthy()
        expect(screen.getByText('Kaboom')).toBeTruthy()
        await fireEvent.press(screen.getByText('fix it'))
        await fireEvent.press(screen.getByText('Try again'))
        expect(screen.getByText('All good')).toBeTruthy()
    })
})

describe('DateField (phone)', () => {
    beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date(2026, 9, 5, 23)) })
    afterEach(() => jest.useRealTimers())

    it('Today and Yesterday fill in local dates', async () => {
        const onChange = jest.fn()
        await render(<DateField value="" onChange={onChange} />)
        await fireEvent.press(screen.getByText('Today'))
        await fireEvent.press(screen.getByText('Yesterday'))
        expect(onChange.mock.calls).toEqual([['2026-10-05'], ['2026-10-04']])
    })

    it('tidies a typed date when you leave the field', async () => {
        const onChange = jest.fn()
        await render(<DateField value="10/3/2026" onChange={onChange} />)
        await fireEvent(screen.getByPlaceholderText('e.g. 10/5 or 2026-10-05'), 'blur')
        expect(onChange).toHaveBeenCalledWith('2026-10-03')
    })

    it('leaves an unreadable date for the form to flag', async () => {
        const onChange = jest.fn()
        await render(<DateField value="soon" onChange={onChange} />)
        await fireEvent(screen.getByPlaceholderText('e.g. 10/5 or 2026-10-05'), 'blur')
        expect(onChange).not.toHaveBeenCalled()
    })

    it('submits on Enter', async () => {
        const onSubmit = jest.fn()
        await render(<DateField value="2026-10-05" onChange={jest.fn()} onSubmit={onSubmit} />)
        await fireEvent(screen.getByPlaceholderText('e.g. 10/5 or 2026-10-05'), 'submitEditing')
        expect(onSubmit).toHaveBeenCalled()
    })
})

describe('useToast', () => {
    it('shows and hides a message', async () => {
        const { result } = await renderHook(() => useToast())
        await act(() => result.current.showToast('Saved', 'error'))
        expect(result.current.toast).toEqual({ message: 'Saved', type: 'error', visible: true })
        await act(() => result.current.hideToast())
        expect(result.current.toast.visible).toBe(false)
    })
})
