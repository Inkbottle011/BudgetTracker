import { useState } from 'react'
import { Text } from 'react-native'
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react-native'
import { TransactionCard } from '../TransactionCard'
import { ErrorBoundary } from '../ErrorBoundary'
import { DateField } from '../DateField'
import { useToast } from '../../hooks/useToast'

describe('TransactionCard', () => {
    const base = { id: '1', user_id: 'u', category_id: '', date: '2026-10-01', created_at: '', type: 'expense' as const, amount: 12.5 }

    it('shows the transaction name', async () => {
        await render(<TransactionCard transaction={{ ...base, name: 'Groceries', note: '' }} />)
        expect(screen.getByText('Groceries')).toBeTruthy()
        expect(screen.getByText('-$12.50')).toBeTruthy()
    })

    it('falls back to the note, then the category, then "Transaction"', async () => {
        const { rerender } = await render(<TransactionCard transaction={{ ...base, name: '', note: 'Weekly shop' }} />)
        expect(screen.getByText('Weekly shop')).toBeTruthy()
        await rerender(<TransactionCard transaction={{ ...base, category_label: 'Food' }} />)
        expect(screen.getByText('Food')).toBeTruthy()
        await rerender(<TransactionCard transaction={{ ...base }} />)
        expect(screen.getByText('Transaction')).toBeTruthy()
    })

    it('shows income with a plus and copes with amounts stored as text', async () => {
        await render(<TransactionCard transaction={{ ...base, type: 'income', amount: '2000' as any, name: 'Pay' }} />)
        expect(screen.getByText('+$2000.00')).toBeTruthy()
    })
})

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
        await fireEvent.press(screen.getByText('Try Again'))
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
