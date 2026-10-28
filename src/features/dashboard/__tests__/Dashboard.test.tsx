import { render, screen, fireEvent } from '@testing-library/react-native'
import Dashboard from '../screens/DashboardScreen'
import { useTransactionStore } from '../../transactions/logic/useTransactionStore'
import { fake } from '../../../../test/fakeSupabase'
import { useTransactionFilters } from '../../transactions/api'

jest.mock('../../../shared/supabase', () => require('../../../../test/fakeSupabase').module)
const mockNavigate = jest.fn()
jest.mock('@react-navigation/native', () => ({
    useFocusEffect: (effect: () => void) => require('react').useEffect(effect, []),
    useNavigation: () => ({ navigate: mockNavigate }),
}))

beforeEach(() => {
    fake.reset()
    mockNavigate.mockClear()
    useTransactionStore.setState({ transactions: [] })
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
    jest.setSystemTime(new Date(2026, 9, 12, 12)) // Mon Oct 12
    fake.table('budget_items', { data: [{ id: 'food', name: 'Food', type: 'expense' }, { id: 'rent', name: 'Rent', type: 'expense' }] })
    fake.table('budget_amounts', { data: [
        { budget_item_id: 'food', year: 2026, month: 10, amount: 310 },
        { budget_item_id: 'rent', year: 2026, month: 10, amount: 700 },
    ] })
    fake.table('subscriptions', { data: [] })
    fake.table('bank_accounts', { data: [] })
    fake.table('transactions', { data: [
        { id: '1', date: '2026-10-12', type: 'expense', amount: 12, name: 'Tacos', category_label: 'Food' },
        { id: '2', date: '2026-10-08', type: 'expense', amount: 40, name: 'Groceries', category_label: 'Food' },
        { id: '3', date: '2026-10-01', type: 'expense', amount: 700, name: 'Rent', category_label: 'Rent' },
        { id: '4', date: '2026-10-02', type: 'income', amount: 1200, name: 'Paycheck', category_label: '' },
        { id: '5', date: '2026-09-20', type: 'expense', amount: 99, name: 'Last month', category_label: 'Food' },
    ] })
})
afterEach(() => jest.useRealTimers())

it('opens on this month: spent against the plan and each category', async () => {
    await render(<Dashboard />)
    expect(await screen.findByText('October 2026')).toBeTruthy()
    expect(screen.getByText('Spent in October')).toBeTruthy()
    expect(screen.getByText('$752.00')).toBeTruthy()
    expect(screen.getByText('of $1,010.00 planned')).toBeTruthy()
    expect(screen.getByText('$258.00 left')).toBeTruthy()   // Food: 310 - 52
})

it('switches to this week, Monday to Sunday, with the plan spread over the days', async () => {
    await render(<Dashboard />)
    await screen.findByText('October 2026')
    await fireEvent.press(screen.getByText('Week'))
    expect(screen.getByText('Oct 12 – 18')).toBeTruthy()
    expect(screen.getByText('Spent this week')).toBeTruthy()
    expect(screen.getAllByText('$12.00').length).toBeGreaterThan(0)
    expect(screen.getByText('of $228.06 planned')).toBeTruthy()   // (310 + 700) / 31 * 7
})

it('switches to a single day and steps back to yesterday, with a way back to today', async () => {
    await render(<Dashboard />)
    await screen.findByText('October 2026')
    await fireEvent.press(screen.getByText('Day'))
    expect(screen.getByText('Today')).toBeTruthy()
    await fireEvent.press(screen.getByLabelText('Previous day'))
    expect(screen.getByText('Yesterday')).toBeTruthy()
    await fireEvent.press(screen.getByText('Back to today'))
    expect(screen.getByText('Today')).toBeTruthy()
})

it('steps between months', async () => {
    await render(<Dashboard />)
    await screen.findByText('October 2026')
    await fireEvent.press(screen.getByLabelText('Previous month'))
    expect(screen.getByText('September 2026')).toBeTruthy()
    expect(screen.getByText('Spent in September')).toBeTruthy()
    expect(screen.getAllByText('$99.00').length).toBeGreaterThan(0)
})

it('takes you to categorize or edit the budget', async () => {
    fake.table('transactions', { data: [{ id: '1', date: '2026-10-12', type: 'expense', amount: 12, name: 'Tacos', category_label: '' }] })
    await render(<Dashboard />)
    await fireEvent.press(await screen.findByText('Give these a category'))
    expect(mockNavigate).toHaveBeenCalledWith('Transactions')
    await fireEvent.press(screen.getByText('Edit budget'))
    expect(mockNavigate).toHaveBeenCalledWith('Budget')
})

describe('subscriptions spotted in your spending', () => {
    const charges = (name: string, dates: string[]) =>
        dates.map(date => ({ id: `${name}-${date}`, date, type: 'expense', amount: 9.99, name, category_label: 'Subscriptions' }))

    it('mentions them under Coming up, with a way to review them', async () => {
        fake.table('transactions', { data: [
            ...charges('Spotify', ['2026-07-07', '2026-08-07', '2026-09-07', '2026-10-07']),
            ...charges('iCloud', ['2026-08-03', '2026-09-03', '2026-10-03']),
        ] })
        fake.table('dismissed_subscription_suggestions', { data: [] })
        await render(<Dashboard />)
        expect(await screen.findByText('2 charges look like subscriptions you haven\'t added.')).toBeTruthy()
        await fireEvent.press(screen.getByRole('button', { name: 'Review possible subscriptions' }))
        expect(mockNavigate).toHaveBeenCalledWith('Subscriptions')
    })

    it('says nothing when there are none', async () => {
        await render(<Dashboard />)
        await screen.findByText('October 2026')
        expect(screen.queryByRole('button', { name: 'Review possible subscriptions' })).toBeNull()
    })
})

describe('pending charges', () => {
    it('mentions what\'s pending this period (not counted yet) and lists it under Recent', async () => {
        fake.table('bank_pending_transactions', { data: [
            { id: 'p1', date: '2026-10-12', amount: 12.5, money_in: false, name: 'Lunch Spot' },
            { id: 'p0', date: '2026-08-01', amount: 99, money_in: false, name: 'Old one' },
        ] })
        await render(<Dashboard />)
        expect(await screen.findByText(/Plus \$12\.50 pending at your bank, not counted until it posts\./)).toBeTruthy()
        expect(screen.getByText('Lunch Spot')).toBeTruthy()
        expect(screen.getAllByText('Pending').length).toBeGreaterThan(0)
    })
})

it('tapping a budget bar opens its transactions for the period shown', async () => {
    await render(<Dashboard />)
    await fireEvent.press(await screen.findByRole('button', { name: 'See Food transactions' }))
    expect(mockNavigate).toHaveBeenCalledWith('Transactions')
    const f = useTransactionFilters.getState()
    expect([f.category, f.preset, f.from, f.to]).toEqual(['Food', 'custom', '2026-10-01', '2026-10-31'])
})

it('privacy mode hides every amount', async () => {
    const { usePrivacy } = require('../../../shared/ui/Private')
    usePrivacy.setState({ hidden: true, loaded: true })
    try {
        await render(<Dashboard />)
        expect(await screen.findByText('October 2026')).toBeTruthy()
        expect(screen.queryAllByText(/\$\d/).map(t => [].concat(t.props.children).join(''))).toEqual([])
        expect(screen.getAllByText(/•••••/).length).toBeGreaterThan(3)
    } finally {
        usePrivacy.setState({ hidden: false })
    }
})
