import { render, screen, fireEvent, within, act } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import TransactionsScreen from '../screens/TransactionsScreen'
import { ToastContext } from '../../../shared/ui/ToastContext'
import { useTransactionStore } from '../logic/useTransactionStore'
import { useTransactionFilters, showTransactionsFor } from '../logic/filters'
import { fake } from '../../../../test/fakeSupabase'

jest.mock('../../../shared/supabase', () => require('../../../../test/fakeSupabase').module)

const saved = [
    { id: 't1', date: '2026-10-01', type: 'income', amount: 2000, name: 'Paycheck', note: '', category_label: 'Salary' },
    { id: 't2', date: '2026-10-02', type: 'expense', amount: 15.99, name: 'Netflix', note: '', category_label: 'Entertainment' },
    { id: 't3', date: '2026-10-03', type: 'expense', amount: 82.1, name: 'Groceries', note: 'weekly shop', category_label: 'Food' },
    { id: 't4', date: '2026-09-10', type: 'expense', amount: 30, name: 'Old dinner', note: '', category_label: 'Food' },
    { id: 't5', date: '2026-10-04', type: 'expense', amount: 9, name: 'Mystery', note: '', category_label: '' },
]

async function renderScreen() {
    await render(<ToastContext.Provider value={{ showToast: jest.fn() }}><TransactionsScreen /></ToastContext.Provider>)
    await screen.findByText('Groceries')
}
const filters = () => within(screen.getByLabelText('Filters'))

beforeEach(async () => {
    fake.reset()
    await AsyncStorage.clear()
    useTransactionFilters.getState().reset()
    useTransactionStore.setState({ transactions: [] })
    fake.table('transactions', { data: saved })
    fake.table('budget_items', { data: [{ name: 'Food', type: 'expense' }, { name: 'Entertainment', type: 'expense' }] })
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
    jest.setSystemTime(new Date(2026, 9, 5, 12))
})
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks() })

it('quick date ranges, with what is shown and its totals at the top', async () => {
    await renderScreen()
    await fireEvent.press(screen.getByText('Filter'))
    await fireEvent.press(filters().getByRole('button', { name: 'This month' }))
    expect(screen.queryByText('Old dinner')).toBeNull()
    expect(screen.getByText('Oct 1 – Oct 31')).toBeTruthy()
    expect(screen.getByText('4 transactions · $2,000.00 in · $107.09 out')).toBeTruthy()
    await fireEvent.press(filters().getByRole('button', { name: 'Last month' }))
    expect(screen.getByText('Old dinner')).toBeTruthy()
    expect(screen.queryByText('Groceries')).toBeNull()
    await fireEvent.press(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.getByText('Groceries')).toBeTruthy()
    expect(screen.getByText('Old dinner')).toBeTruthy()
})

it('filters by category, including spending with none yet', async () => {
    await renderScreen()
    await fireEvent.press(screen.getByText('Filter'))
    await fireEvent.press(filters().getByRole('button', { name: 'Food' }))
    expect(screen.getByText('Groceries')).toBeTruthy()
    expect(screen.getByText('Old dinner')).toBeTruthy()
    expect(screen.queryByText('Netflix')).toBeNull()
    expect(screen.getByText('2 transactions · $112.10 out')).toBeTruthy()
    await fireEvent.press(filters().getByRole('button', { name: 'Uncategorized' }))
    expect(screen.getByText('Mystery')).toBeTruthy()
    expect(screen.queryByText('Groceries')).toBeNull()
})

it('remembers your filters next time you open the app', async () => {
    await renderScreen()
    await fireEvent.press(screen.getByText('Filter'))
    await fireEvent.press(filters().getByRole('button', { name: 'Food' }))
    await fireEvent.press(filters().getByRole('button', { name: 'This month' }))
    await act(async () => { screen.unmount() })
    // A fresh start: nothing in memory, only what was saved on this device
    useTransactionFilters.getState().reset()
    await render(<ToastContext.Provider value={{ showToast: jest.fn() }}><TransactionsScreen /></ToastContext.Provider>)
    expect(await screen.findByText('Food · Oct 1 – Oct 31')).toBeTruthy()
    expect(screen.queryByText('Netflix')).toBeNull()
    expect(screen.queryByText('Old dinner')).toBeNull()
})

it('another page can open the list filtered (for example a Dashboard budget bar)', async () => {
    await act(() => showTransactionsFor({ category: 'Food', from: '2026-09-01', to: '2026-09-30' }))
    await render(<ToastContext.Provider value={{ showToast: jest.fn() }}><TransactionsScreen /></ToastContext.Provider>)
    expect(await screen.findByText('Old dinner')).toBeTruthy()
    expect(screen.getByText('Food · Sep 1 – Sep 30')).toBeTruthy()
    expect(screen.queryByText('Groceries')).toBeNull()
})
