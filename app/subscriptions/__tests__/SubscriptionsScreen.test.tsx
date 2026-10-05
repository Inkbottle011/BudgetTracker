import { render, screen, fireEvent } from '@testing-library/react-native'
import SubscriptionsScreen from '../index'
import { ToastContext } from '../../../context/ToastContext'
import { fake, supabase } from '../../../test/fakeSupabase'

jest.mock('../../../lib/supabase', () => require('../../../test/fakeSupabase').module)
// Outside the app's navigator, treat "screen shown" as "tab opened"
jest.mock('@react-navigation/native', () => ({
    useFocusEffect: (effect: () => void) => require('react').useEffect(effect, []),
}))

const sub = (o: any) => ({
    id: 's', user_id: 'user-1', name: 'Sub', amount: 10, type: 'expense', category_label: null, note: null,
    frequency: 'monthly', start_date: '2026-01-10', end_date: null, status: 'active', generated_through: '2026-09-10',
    created_at: '2026-01-01', ...o,
})

const showToast = jest.fn()

async function renderScreen() {
    await render(<ToastContext.Provider value={{ showToast }}><SubscriptionsScreen /></ToastContext.Provider>)
}

beforeEach(() => {
    fake.reset()
    showToast.mockClear()
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
    jest.setSystemTime(new Date(2026, 9, 5, 12))
    fake.table('budget_items', { data: [] })
    fake.table('subscriptions', {
        data: [
            sub({ id: 'n', name: 'Netflix', amount: 15.99, start_date: '2026-01-15', generated_through: '2026-09-15' }),
            sub({ id: 'g', name: 'Gym', amount: 10, frequency: 'weekly', start_date: '2026-10-01', generated_through: '2026-10-01' }),
            sub({ id: 'p', name: 'Paycheck', amount: 2000, type: 'income', frequency: 'biweekly', start_date: '2026-09-25', generated_through: '2026-09-25' }),
            sub({ id: 'z', name: 'Paused gym', status: 'paused' }),
            sub({ id: 'x', name: 'Old trial', end_date: '2026-03-01' }),
        ],
    })
})
afterEach(() => jest.useRealTimers())

it('groups subscriptions and shows the next charge', async () => {
    await renderScreen()
    expect(await screen.findByText('Active · 3')).toBeTruthy()
    expect(screen.getByText('Paused · 1')).toBeTruthy()
    expect(screen.getByText('Ended · 1')).toBeTruthy()
    expect(screen.getByText(/Next charge Oct 15, 2026/)).toBeTruthy()
    expect(screen.getByText('Paused · no charges until resumed')).toBeTruthy()
})

it('totals monthly spending, counting only active expenses', async () => {
    await renderScreen()
    // Netflix 15.99 + Gym 10 x 52/12 = 59.32
    expect(await screen.findByText('$59.32')).toBeTruthy()
    expect(screen.getByText('$711.88')).toBeTruthy() // per year
    expect(screen.getByText('$4333.33')).toBeTruthy() // income per month: 2000 x 26/12
})

it('shows an empty state with no subscriptions', async () => {
    fake.table('subscriptions', { data: [] })
    await renderScreen()
    expect(await screen.findByText('No subscriptions yet')).toBeTruthy()
})

it('shows a load error with a retry', async () => {
    fake.table('subscriptions', { data: null, error: { message: 'offline' } })
    await renderScreen()
    expect(await screen.findByText("Couldn't load subscriptions: offline")).toBeTruthy()
})

it('adds a subscription, accepting "$" amounts and US dates, then adds due charges', async () => {
    ;(supabase.rpc as jest.Mock).mockResolvedValue({ data: 2, error: null })
    await renderScreen()
    await fireEvent.press(await screen.findByText('+ Add'))
    await fireEvent.changeText(screen.getByPlaceholderText('e.g. Netflix, Rent, Paycheck'), 'Spotify')
    await fireEvent.changeText(screen.getByPlaceholderText('0.00'), '$9.99')
    const [start] = screen.getAllByPlaceholderText('YYYY-MM-DD')
    await fireEvent.changeText(start, '9/3/2026')
    expect(screen.getByText(/2 past charges from Sep 3, 2026 to today will be added/)).toBeTruthy()
    await fireEvent.press(screen.getByText('Add Subscription'))
    expect(fake.arg('subscriptions', 'insert')).toMatchObject({
        name: 'Spotify', amount: 9.99, frequency: 'monthly', start_date: '2026-09-03', end_date: null, type: 'expense',
    })
    expect(supabase.rpc).toHaveBeenCalledWith('generate_subscription_transactions', { p_today: '2026-10-05' })
    expect(showToast).toHaveBeenCalledWith('Added 2 charges to your transactions')
})

it('validates the form', async () => {
    await renderScreen()
    await fireEvent.press(await screen.findByText('+ Add'))
    await fireEvent.changeText(screen.getByPlaceholderText('0.00'), 'free')
    const [, end] = screen.getAllByPlaceholderText('YYYY-MM-DD')
    await fireEvent.changeText(end, '2020-01-01')
    await fireEvent.press(screen.getByText('Add Subscription'))
    expect(screen.getByText('Give it a name, e.g. Netflix')).toBeTruthy()
    expect(screen.getByText('Enter an amount, like 15.99')).toBeTruthy()
    expect(screen.getByText('Must be on or after the first charge')).toBeTruthy()
    expect(fake.arg('subscriptions', 'insert')).toBeUndefined()
})

it('pauses a subscription', async () => {
    await renderScreen()
    await screen.findByText('Netflix')
    await fireEvent.press(screen.getAllByText('Pause')[0])
    expect(fake.arg('subscriptions', 'update')).toEqual({ status: 'paused' })
    expect(showToast).toHaveBeenCalledWith('Subscription paused')
})

it('resuming skips the charges missed while paused', async () => {
    await renderScreen()
    await screen.findByText('Paused gym')
    await fireEvent.press(screen.getAllByText('Resume')[0])
    expect(fake.arg('subscriptions', 'update')).toEqual({ status: 'active', generated_through: '2026-10-04' })
})

it('asks before cancelling or deleting', async () => {
    await renderScreen()
    await screen.findByText('Netflix')
    await fireEvent.press(screen.getAllByText('Delete')[0])
    expect(screen.getByText('Delete? Past charges stay in transactions.')).toBeTruthy()
    await fireEvent.press(screen.getByText('No'))
    expect(fake.calls('subscriptions').some(c => c.ops.some(o => o.method === 'delete'))).toBe(false)

    await fireEvent.press(screen.getAllByText('Cancel')[0])
    await fireEvent.press(screen.getByText('Yes'))
    expect(fake.arg('subscriptions', 'update')).toEqual({ status: 'cancelled' })
})
