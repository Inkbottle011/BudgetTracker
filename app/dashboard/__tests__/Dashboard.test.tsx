import { render, screen } from '@testing-library/react-native'
import Dashboard from '../index'
import { useTransactionStore } from '../../../store/useTransactionStore'
import { fake } from '../../../test/fakeSupabase'

jest.mock('../../../lib/supabase', () => require('../../../test/fakeSupabase').module)
jest.mock('@react-navigation/native', () => ({
    useFocusEffect: (effect: () => void) => require('react').useEffect(effect, []),
}))

beforeEach(() => {
    fake.reset()
    useTransactionStore.setState({ transactions: [] })
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
    jest.setSystemTime(new Date(2026, 9, 5, 12))
    fake.table('budget_items', { data: [{ id: 'rent', name: 'Rent', type: 'expense' }] })
    fake.table('budget_amounts', { data: [{ budget_item_id: 'rent', month: 1, year: 2026, amount: 1000 }] })
    fake.table('subscriptions', { data: [] })
    fake.table('transactions', {
        data: [
            { id: '1', date: '2025-12-31', type: 'income', amount: 100, name: 'Last year', category_label: '' },
            { id: '2', date: '2026-01-01', type: 'income', amount: 3000, name: 'New Year pay', category_label: 'Salary' },
            { id: '3', date: '2026-10-01', type: 'expense', amount: 1200, name: 'Rent', category_label: 'Rent' },
        ],
    })
})
afterEach(() => jest.useRealTimers())

it('counts New Year\'s Day in this year\'s totals and shows the all-time balance', async () => {
    await render(<Dashboard />)
    expect(await screen.findByText('Yearly Overview · 2026')).toBeTruthy()
    expect(screen.getByText('$3,000.00')).toBeTruthy()  // income this year, including Jan 1
    expect(screen.getByText('$1,200.00')).toBeTruthy()  // expenses this year
    expect(screen.getByText('$1,900.00')).toBeTruthy()  // balance: 100 + 3000 - 1200
})

it('renders the charts and budget comparison without errors', async () => {
    await render(<Dashboard />)
    expect(await screen.findByText('Monthly Trend')).toBeTruthy()
    expect(screen.getAllByText('Rent').length).toBeGreaterThan(0)
})
