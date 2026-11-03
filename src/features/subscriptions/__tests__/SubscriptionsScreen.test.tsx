import { render, screen, fireEvent, act } from '@testing-library/react-native'
import SubscriptionsScreen from '../screens/SubscriptionsScreen'
import { ToastContext } from '../../../shared/ui/ToastContext'
import { fake, supabase } from '../../../../test/fakeSupabase'

jest.mock('../../../shared/supabase', () => require('../../../../test/fakeSupabase').module)
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

it('Undo brings a deleted subscription back, still linked to its past charges', async () => {
    await renderScreen()
    await screen.findByText('Netflix')
    fake.table('transactions', call => call.ops.some(o => o.method === 'eq' && o.args[0] === 'subscription_id')
        ? { data: [{ id: 'c1', subscription_id: 'n' }, { id: 'c2', subscription_id: 'n' }] }
        : { data: [], error: null })
    await fireEvent.press(screen.getByLabelText('Delete Netflix'))
    await fireEvent.press(screen.getByText('Yes, delete'))
    const [message, , action] = showToast.mock.calls.at(-1)!
    expect([message, action.label]).toEqual(['Netflix deleted', 'Undo'])
    await act(async () => { await action.onPress() })
    expect(fake.arg('subscriptions', 'insert')).toEqual(expect.objectContaining({ id: 'n', name: 'Netflix' }))
    const relink = fake.calls('transactions').find(c => c.ops.some(o => o.method === 'update'))!
    expect(relink.ops).toContainEqual({ method: 'update', args: [{ subscription_id: 'n' }] })
    expect(relink.ops).toContainEqual({ method: 'in', args: ['id', ['c1', 'c2']] })
    expect(showToast).toHaveBeenLastCalledWith('Netflix is back')
})

describe('subscriptions spotted in your spending', () => {
    const charge = (date: string, name: string, amount: number) =>
        ({ id: `${name}-${date}`, date, name, amount, type: 'expense', category_label: 'Subscriptions', original_name: null, subscription_id: null })
    const ops = (table: string, method: string) => fake.calls(table).flatMap(c => c.ops.filter(o => o.method === method).map(o => ({ args: o.args, call: c })))

    beforeEach(() => {
        fake.table('transactions', {
            data: [
                charge('2026-07-07', 'Spotify', 7.41), charge('2026-08-07', 'Spotify', 7.41), charge('2026-09-07', 'Spotify', 7.41),
                charge('2026-09-15', 'NETFLIX.COM', 17.99),
            ],
        })
        fake.table('dismissed_subscription_suggestions', { data: [] })
    })

    it('suggests charges that repeat, with when the next one is expected', async () => {
        await renderScreen()
        expect(await screen.findByText('Looks like a subscription')).toBeTruthy()
        expect(screen.getByText('$7.41 monthly · charged 3 times · next around Oct 7')).toBeTruthy()
        expect(screen.getByRole('button', { name: 'Add Spotify as a subscription' })).toBeTruthy()
    })

    it('says why an early guess looks like a subscription', async () => {
        fake.table('transactions', { data: [
            charge('2026-09-20', 'HULU 877-824-4858', 15.49),
            charge('2026-09-01', 'Acme Cloud', 7.99), charge('2026-10-01', 'Acme Cloud', 7.99),
            charge('2026-09-28', 'RECURRING PAYMENT BOXCO', 30),
        ] })
        await renderScreen()
        expect(await screen.findByText('$15.49 on Sep 20 · usually a monthly subscription · next around Oct 20')).toBeTruthy()
        expect(screen.getByText('$7.99 twice, a month apart · next around Nov 1')).toBeTruthy()
        expect(screen.getByText('$30.00 on Sep 28 · your bank says it repeats · next around Oct 28')).toBeTruthy()
    })

    it('adding one opens the form filled in, starting at the next charge so past ones aren\'t added twice', async () => {
        await renderScreen()
        await fireEvent.press(await screen.findByRole('button', { name: 'Add Spotify as a subscription' }))
        expect(screen.getByDisplayValue('Spotify')).toBeTruthy()
        expect(screen.getByDisplayValue('7.41')).toBeTruthy()
        expect(screen.getByDisplayValue('2026-10-07')).toBeTruthy()
    })

    it('"Not a subscription" hides it for good', async () => {
        await renderScreen()
        await fireEvent.press(await screen.findByRole('button', { name: 'Spotify is not a subscription' }))
        expect(ops('dismissed_subscription_suggestions', 'upsert')[0].args[0]).toEqual({ merchant_key: 'spotify' })
        expect(screen.queryByRole('button', { name: 'Add Spotify as a subscription' })).toBeNull()
        expect(showToast).toHaveBeenCalledWith("Spotify won't be suggested again")
    })

    it('leaves out places you said are not subscriptions', async () => {
        fake.table('dismissed_subscription_suggestions', { data: [{ merchant_key: 'spotify' }] })
        await renderScreen()
        expect(await screen.findByText('Active (3)')).toBeTruthy()
        expect(screen.queryByText('Looks like a subscription')).toBeNull()
    })

    it('still suggests if remembering choices isn\'t set up yet', async () => {
        fake.table('dismissed_subscription_suggestions', { data: null, error: { message: 'relation does not exist' } })
        await renderScreen()
        expect(await screen.findByText('Looks like a subscription')).toBeTruthy()
    })

    it('points out a price change and updates the subscription in one tap', async () => {
        await renderScreen()
        expect(await screen.findByText('Netflix charged $17.99 on Sep 15. It\'s saved as $15.99, so update it to keep your totals right.')).toBeTruthy()
        await fireEvent.press(screen.getByRole('button', { name: 'Update Netflix to $17.99' }))
        const update = ops('subscriptions', 'update').find(u => u.args[0].amount === 17.99)!
        expect(update.call.ops.find(o => o.method === 'eq')!.args).toEqual(['id', 'n'])
    })
})

it('privacy mode can hide every amount', async () => {
    const { usePrivacy } = require('../../../shared/ui/Private')
    usePrivacy.setState({ hidden: true, kinds: ['balances', 'totals', 'budget', 'transactions'], loaded: true })
    try {
        await renderScreen()
        await screen.findByText('Netflix')
        expect(screen.queryAllByText(/\$\d/).map(t => [].concat(t.props.children).join(''))).toEqual([])
    } finally { usePrivacy.setState({ hidden: false }) }
})
