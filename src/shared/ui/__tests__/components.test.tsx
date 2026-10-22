import { useState } from 'react'
import { Text } from 'react-native'
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react-native'
import { ErrorBoundary } from '../ErrorBoundary'
import { DateField } from '../DateField'
import { useToast } from '../useToast'
import { Toast } from '../Toast'
import { ConfirmDialog } from '../ConfirmDialog'

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

describe('Toast with an Undo button', () => {
    it('shows the button, runs it once and goes away', async () => {
        const undo = jest.fn(), hide = jest.fn()
        await render(<Toast message="Food deleted" visible onHide={hide} action={{ label: 'Undo', onPress: undo }} />)
        expect(screen.getByText('Food deleted')).toBeTruthy()
        await fireEvent.press(screen.getByRole('button', { name: 'Undo' }))
        expect(undo).toHaveBeenCalledTimes(1)
        expect(hide).toHaveBeenCalled()
    })

    it('useToast keeps the action with the message', async () => {
        const { result } = await renderHook(() => useToast())
        const action = { label: 'Undo', onPress: () => {} }
        await act(() => result.current.showToast('Deleted', 'success', action))
        expect(result.current.toast).toEqual({ message: 'Deleted', type: 'success', visible: true, action })
    })
})

describe('ConfirmDialog', () => {
    it('asks first, and only goes ahead when you confirm', async () => {
        const yes = jest.fn(), no = jest.fn()
        await render(<ConfirmDialog visible title="Delete Food?" message="Its planned amounts go too." confirmLabel="Delete" onConfirm={yes} onCancel={no} />)
        expect(screen.getByText('Delete Food?')).toBeTruthy()
        expect(screen.getByText('Its planned amounts go too.')).toBeTruthy()
        await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }))
        expect(no).toHaveBeenCalled()
        expect(yes).not.toHaveBeenCalled()
        await fireEvent.press(screen.getByRole('button', { name: 'Delete' }))
        expect(yes).toHaveBeenCalled()
    })

    it('shows nothing when closed', async () => {
        await render(<ConfirmDialog visible={false} title="Delete Food?" confirmLabel="Delete" onConfirm={() => {}} onCancel={() => {}} />)
        expect(screen.queryByText('Delete Food?')).toBeNull()
    })
})
