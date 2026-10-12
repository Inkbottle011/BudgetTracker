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

function setWidth(width: number) {
    jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({ width, height: 800, scale: 1, fontScale: 1 })
}

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
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks() })

it('groups subscriptions in sentence case and shows the next charge', async () => {
    await renderScreen()
    expect(await screen.findByText('Active (3)')).toBeTruthy()
    expect(screen.getByText('Paused (1)')).toBeTruthy()
    expect(screen.getByText('Ended (1)')).toBeTruthy()
    expect(screen.queryByText(/·\s*\d+$/)).toBeNull()
    // This year's dates leave the year off
    expect(screen.getByText('Next charge Oct 15')).toBeTruthy()
    expect(screen.getByText('Paused · no charges until resumed')).toBeTruthy()
    expect(screen.getByText('Ended Mar 1')).toBeTruthy()
})

it('shows category or type with how often, and the amount per period', async () => {
    fake.table('subscriptions', { data: [sub({ id: 'n', name: 'Netflix', amount: 15.99, category_label: 'Entertainment' })] })
    await renderScreen()
    expect(await screen.findByText('Entertainment · Monthly')).toBeTruthy()
    expect(screen.getAllByText('$15.99')).toHaveLength(2) // the row and the monthly total
    expect(screen.getByText('/ month')).toBeTruthy()
})

it('totals per month and per year, counting only active subscriptions', async () => {
    await renderScreen()
    expect(await screen.findByText('Per month')).toBeTruthy()
    expect(screen.getByText('Per year')).toBeTruthy()
    // Netflix 15.99 + Gym 10 x 52/12 = 59.32
    expect(screen.getByText('$59.32')).toBeTruthy()
    expect(screen.getByText('$711.88')).toBeTruthy() // per year
    expect(screen.getByText('+$4,333.33 coming in')).toBeTruthy() // income per month: 2000 x 26/12
    expect(screen.getByText('+$52,000.00 coming in')).toBeTruthy()
})

it('shows an empty state with no subscriptions', async () => {
    fake.table('subscriptions', { data: [] })
    await renderScreen()
    expect(await screen.findByText('No subscriptions yet')).toBeTruthy()
    expect(screen.getByText("Add things that repeat, like Spotify or rent, and they'll be added to your transactions on their dates.")).toBeTruthy()
})

it('shows a load error with a retry', async () => {
    fake.table('subscriptions', { data: null, error: { message: 'offline' } })
    await renderScreen()
    expect(await screen.findByText("Couldn't load subscriptions: offline")).toBeTruthy()
    expect(screen.getByText('Try again')).toBeTruthy()
})

it('adds a subscription, accepting "$" amounts and US dates, then adds due charges', async () => {
    ;(supabase.rpc as jest.Mock).mockResolvedValue({ data: 2, error: null })
    await renderScreen()
    await fireEvent.press(await screen.findByText('Add subscription'))
    expect(screen.getByText('New subscription')).toBeTruthy()
    await fireEvent.changeText(screen.getByPlaceholderText('e.g. Netflix, Rent, Paycheck'), 'Spotify')
    await fireEvent.changeText(screen.getByPlaceholderText('0.00'), '$9.99')
    const [start] = screen.getAllByPlaceholderText('YYYY-MM-DD')
    await fireEvent.changeText(start, '9/3/2026')
    expect(screen.getByText(/2 past charges from Sep 3 to today will be added/)).toBeTruthy()
    await fireEvent.press(screen.getByText('Add subscription'))
    expect(fake.arg('subscriptions', 'insert')).toMatchObject({
        name: 'Spotify', amount: 9.99, frequency: 'monthly', start_date: '2026-09-03', end_date: null, type: 'expense',
    })
    expect(supabase.rpc).toHaveBeenCalledWith('generate_subscription_transactions', { p_today: '2026-10-05' })
    expect(showToast).toHaveBeenCalledWith('Added 2 charges to your transactions')
})

it('validates the form', async () => {
    await renderScreen()
    await fireEvent.press(await screen.findByText('Add subscription'))
    await fireEvent.changeText(screen.getByPlaceholderText('0.00'), 'free')
    const [, end] = screen.getAllByPlaceholderText('YYYY-MM-DD')
    await fireEvent.changeText(end, '2020-01-01')
    await fireEvent.press(screen.getByText('Add subscription'))
    expect(screen.getByText('Give it a name, e.g. Netflix')).toBeTruthy()
    expect(screen.getByText('Enter an amount, like 15.99')).toBeTruthy()
    expect(screen.getByText('Must be on or after the first charge')).toBeTruthy()
    expect(fake.arg('subscriptions', 'insert')).toBeUndefined()
})

it('tapping a subscription opens it for editing', async () => {
    await renderScreen()
    await fireEvent.press(await screen.findByLabelText('Edit Netflix'))
    expect(screen.getByText('Edit subscription')).toBeTruthy()
    expect(screen.getByDisplayValue('Netflix')).toBeTruthy()
    expect(screen.getByDisplayValue('15.99')).toBeTruthy()
    await fireEvent.changeText(screen.getByDisplayValue('15.99'), '17.99')
    await fireEvent.press(screen.getByText('Save changes'))
    expect(fake.arg('subscriptions', 'update')).toMatchObject({ name: 'Netflix', amount: 17.99 })
    expect(showToast).toHaveBeenCalledWith('Subscription updated')
})

it('on a computer, the form sits beside the list', async () => {
    setWidth(1200)
    await renderScreen()
    await fireEvent.press(await screen.findByLabelText('Edit Netflix'))
    expect(screen.getByText('Edit subscription')).toBeTruthy()
    expect(screen.getByText('Active (3)')).toBeTruthy()
    await fireEvent.press(screen.getByLabelText('Close form'))
    expect(screen.queryByText('Edit subscription')).toBeNull()
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
    await fireEvent.press(screen.getByLabelText('Delete Netflix'))
    expect(screen.getByText('Delete? Past charges stay in transactions.')).toBeTruthy()
    await fireEvent.press(screen.getByText('Keep it'))
    expect(fake.calls('subscriptions').some(c => c.ops.some(o => o.method === 'delete'))).toBe(false)

    await fireEvent.press(screen.getByLabelText('Cancel Netflix'))
    expect(screen.getByText('Cancel? No more charges will be added.')).toBeTruthy()
    await fireEvent.press(screen.getByText('Yes, cancel it'))
    expect(fake.arg('subscriptions', 'update')).toEqual({ status: 'cancelled' })

    await fireEvent.press(screen.getByLabelText('Delete Gym'))
    await fireEvent.press(screen.getByText('Yes, delete'))
    expect(fake.calls('subscriptions').some(c => c.ops.some(o => o.method === 'delete'))).toBe(true)
})
