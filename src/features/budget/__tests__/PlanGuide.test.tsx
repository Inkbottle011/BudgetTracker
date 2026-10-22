import { render, screen, fireEvent, within } from '@testing-library/react-native'
import BudgetScreen from '../screens/BudgetScreen'
import { ToastContext } from '../../../shared/ui/ToastContext'
import { fake } from '../../../../test/fakeSupabase'
import { useTransactionStore } from '../../transactions/api'

jest.mock('../../../shared/supabase', () => require('../../../../test/fakeSupabase').module)

const showToast = jest.fn()
const ops = (table: string, method: string) => fake.calls(table).flatMap(c => c.ops.filter(o => o.method === method).map(o => o.args))

beforeEach(() => {
    fake.reset()
    showToast.mockClear()
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
    jest.setSystemTime(new Date(2026, 9, 22, 12))   // Oct 22, 2026
    let n = 0
    fake.table('budget_items', call => {
        const insert = call.ops.find(o => o.method === 'insert')
        if (insert) return { data: { id: `new-${++n}`, ...insert.args[0] }, error: null }
        return { data: [{ id: 'rent', name: 'Rent', type: 'expense' }, { id: 'pay', name: 'Pay', type: 'income' }], error: null }
    })
    fake.table('budget_amounts', call => call.ops.some(o => o.method === 'upsert')
        ? { data: null, error: null }
        : { data: [{ budget_item_id: 'rent', month: 10, year: 2026, amount: 900 }], error: null })
    fake.table('subscriptions', { data: [] })
    useTransactionStore.setState({ transactions: [
        { id: 'a', date: '2026-08-03', type: 'expense', amount: 300, category_label: 'Groceries' },
        { id: 'b', date: '2026-09-03', type: 'expense', amount: 240, category_label: 'Groceries' },
    ] as any })
    fake.table('transactions', { data: null, error: null })
})
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks() })

async function openGuide() {
    await render(<ToastContext.Provider value={{ showToast }}><BudgetScreen /></ToastContext.Provider>)
    await screen.findAllByText('Rent')
    await fireEvent.press(screen.getByRole('button', { name: 'Plan with questions' }))
    expect(await screen.findByText('Your income')).toBeTruthy()
}

it('asks a few questions, works out monthly amounts, and adds them to the budget', async () => {
    await openGuide()

    // 1. Income: one hourly job
    await fireEvent.press(screen.getByRole('button', { name: '1 job' }))
    await fireEvent.changeText(screen.getByLabelText('Job 1 name'), 'Cafe')
    await fireEvent.changeText(screen.getByLabelText('Hourly rate'), '20')
    await fireEvent.changeText(screen.getByLabelText('Hours a week'), '25')
    await fireEvent.changeText(screen.getByLabelText('Taken out for taxes (%)'), '10')
    expect(screen.getByText('About $1,950.00 a month take-home')).toBeTruthy()
    await fireEvent.press(screen.getByRole('button', { name: 'Next' }))

    // 2. Costs: your Rent is already filled in; add groceries per week
    expect(await screen.findByText('Your regular costs')).toBeTruthy()
    expect(screen.getByLabelText('Rent amount').props.value).toBe('900')
    await fireEvent.press(screen.getByRole('button', { name: 'Add Groceries' }))
    expect(screen.getByText("You've spent about $180.00 a month on this lately")).toBeTruthy()
    await fireEvent.changeText(screen.getByLabelText('Groceries amount'), '60')
    await fireEvent.press(screen.getByRole('button', { name: 'Groceries per week' }))
    expect(screen.getByText('$260.00 a month')).toBeTruthy()
    await fireEvent.press(screen.getByRole('button', { name: 'Next' }))

    // 3. Saving: an emergency fund of $3,000 in a year
    expect(await screen.findByText('Saving goals')).toBeTruthy()
    await fireEvent.changeText(screen.getByLabelText('Emergency fund: how much you want saved'), '3000')
    await fireEvent.changeText(screen.getByLabelText('Emergency fund: by when (YYYY-MM)'), '2027-10')
    expect(screen.getByText('$250.00 a month for 12 months')).toBeTruthy()
    await fireEvent.press(screen.getByRole('button', { name: 'Next' }))

    // 4. Review
    expect(await screen.findByText('Review your plan')).toBeTruthy()
    expect(screen.getByLabelText('Cafe per month').props.value).toBe('1950')
    expect(screen.getByLabelText('Groceries per month').props.value).toBe('260')
    expect(screen.getByText('Left over each month')).toBeTruthy()
    expect(screen.getByText('$540.00')).toBeTruthy()   // 1,950 - 900 - 260 - 250
    await fireEvent.press(screen.getByRole('button', { name: 'Add to my budget' }))

    expect(ops('budget_items', 'insert').map(a => a[0].name)).toEqual(['Cafe', 'Groceries', 'Emergency fund'])
    const rows = ops('budget_amounts', 'upsert')[0][0]
    expect(new Set(rows.map((r: any) => r.month))).toEqual(new Set([10, 11, 12]))   // from this month on
    expect(showToast).toHaveBeenCalledWith('Budget updated: 3 added, 1 updated')
    expect(screen.queryByText('Review your plan')).toBeNull()
})

it('lets you change any amount on the review step, and warns when you plan more than comes in', async () => {
    await openGuide()
    await fireEvent.press(screen.getByRole('button', { name: '1 job' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Salary' }))
    await fireEvent.changeText(screen.getByLabelText('Salary per year'), '12000')
    await fireEvent.press(screen.getByRole('button', { name: 'Next' }))
    await fireEvent.press(await screen.findByRole('button', { name: 'Next' }))
    await fireEvent.press(await screen.findByRole('button', { name: 'Next' }))
    expect(await screen.findByText('Review your plan')).toBeTruthy()
    await fireEvent.changeText(screen.getByLabelText('Rent per month'), '1500')
    expect(screen.getByText(/You're planning \$500\.00 a month more than comes in/)).toBeTruthy()
    // Whole year instead of from this month
    await fireEvent.press(screen.getByRole('button', { name: 'All of 2026' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Add to my budget' }))
    const rows = ops('budget_amounts', 'upsert')[0][0]
    expect(rows.filter((r: any) => r.budget_item_id === 'rent').map((r: any) => r.amount)).toEqual(Array(12).fill(1500))
})

it('can go back a step, or close without saving', async () => {
    await openGuide()
    await fireEvent.press(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('Your regular costs')).toBeTruthy()
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByText('Your income')).toBeTruthy()
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByText('Your income')).toBeNull()
    expect(ops('budget_amounts', 'upsert')).toEqual([])
})
