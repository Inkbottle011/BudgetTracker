import { render, screen, fireEvent } from '@testing-library/react-native'
import BudgetScreen from '../screens/BudgetScreen'
import { ToastContext } from '../../../shared/ui/ToastContext'
import { fake } from '../../../../test/fakeSupabase'

jest.mock('../../../shared/supabase', () => require('../../../../test/fakeSupabase').module)

const showToast = jest.fn()
const upserts = () => fake.calls('budget_amounts').flatMap(c => c.ops.filter(o => o.method === 'upsert').map(o => o.args[0]))
const months = (id: string, amount: (m: number) => number) =>
    Array.from({ length: 12 }, (_, i) => ({ budget_item_id: id, month: i + 1, year: 2026, amount: amount(i + 1) }))

function setWidth(width: number) {
    jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({ width, height: 800, scale: 1, fontScale: 1 })
}

beforeEach(() => {
    fake.reset()
    showToast.mockClear()
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
    jest.setSystemTime(new Date(2026, 9, 22, 12))   // Oct 22, 2026
    fake.table('budget_items', { data: [
        { id: 'rent', name: 'Rent', type: 'expense' },
        { id: 'pay', name: 'Pay', type: 'income' },
        { id: 'trip', name: 'Trip', type: 'savings' },
    ] })
    fake.table('budget_amounts', call => call.ops.some(o => o.method === 'upsert') ? { data: null, error: null } : { data: [
        ...months('rent', () => 900),
        ...months('pay', m => (m === 10 ? 3500 : 3000)),   // a bonus in October
        ...months('trip', () => 100),
    ] })
})
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks() })

async function renderScreen() {
    await render(<ToastContext.Provider value={{ showToast }}><BudgetScreen /></ToastContext.Provider>)
    await screen.findByText('Rent')
}

it('shows each item once, with what it is each month, and a summary of the month', async () => {
    await renderScreen()
    expect(screen.getByRole('button', { name: 'Change Rent, $900 a month' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Change Pay, $3,500 in October' })).toBeTruthy()
    expect(screen.getByText('Varies by month')).toBeTruthy()
    // October: 3,500 in, 900 out, 100 saved
    expect(screen.getByText('Your month (October)')).toBeTruthy()
    expect(screen.getByText('$2,500')).toBeTruthy()
    // No 12-month grid until you ask for it
    expect(screen.queryByLabelText('Rent, Jan')).toBeNull()
})

it('changes an amount for every month in one go', async () => {
    await renderScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Change Rent, $900 a month' }))
    await fireEvent.changeText(screen.getByLabelText('New amount for Rent'), '950')
    await fireEvent.press(screen.getByRole('button', { name: 'Every month' }))
    const rows = upserts()[0]
    expect(rows).toHaveLength(12)
    expect(rows.every((r: any) => r.amount === 950 && r.budget_item_id === 'rent' && r.year === 2026)).toBe(true)
    expect(showToast).toHaveBeenCalledWith('Rent: $950 every month')
    expect(screen.getByRole('button', { name: 'Change Rent, $950 a month' })).toBeTruthy()
})

it('or from this month on, leaving earlier months alone', async () => {
    await renderScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Change Rent, $900 a month' }))
    await fireEvent.changeText(screen.getByLabelText('New amount for Rent'), '1,000')
    await fireEvent.press(screen.getByRole('button', { name: 'Oct to Dec' }))
    expect(upserts().map((r: any) => r.month)).toEqual([10, 11, 12])
    expect(screen.getByRole('button', { name: 'Change Rent, $1,000 in October' })).toBeTruthy()
})

it('shows the months of an item that varies, and can switch to editing month by month', async () => {
    setWidth(400)
    await renderScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Show Pay by month' }))
    expect(screen.getByText('Oct $3,500')).toBeTruthy()
    expect(screen.getByText('Jan $3,000')).toBeTruthy()
    await fireEvent.press(screen.getByRole('button', { name: 'Edit single months' }))
    expect(screen.getByLabelText('Previous month')).toBeTruthy()   // the month-by-month view
})

it('switches to every month side by side on a computer, and back', async () => {
    setWidth(1200)
    await renderScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'By month' }))
    expect(screen.getByLabelText('Rent, Jan')).toBeTruthy()
    await fireEvent.press(screen.getByRole('button', { name: 'Simple' }))
    expect(screen.queryByLabelText('Rent, Jan')).toBeNull()
})

it('adds and deletes items', async () => {
    await renderScreen()
    await fireEvent.press(screen.getByLabelText('Add a spending item'))
    await fireEvent.changeText(screen.getByPlaceholderText('Name, e.g. Groceries'), 'Food')
    fake.table('budget_items', { data: { id: 'food', name: 'Food', type: 'expense' } })
    await fireEvent.press(screen.getByText('Add'))
    expect(await screen.findByText('Food')).toBeTruthy()
    fake.table('budget_items', { data: null })
    await fireEvent.press(screen.getByLabelText('Delete Rent'))
    expect(screen.queryByText('Rent')).toBeNull()
})

it('an empty budget points you to the questions', async () => {
    fake.table('budget_items', { data: [] })
    fake.table('budget_amounts', { data: [] })
    await render(<ToastContext.Provider value={{ showToast }}><BudgetScreen /></ToastContext.Provider>)
    expect(await screen.findByText('Your budget is empty')).toBeTruthy()
    await fireEvent.press(screen.getByRole('button', { name: 'Answer a few questions' }))
    expect(await screen.findByText('Your income')).toBeTruthy()
})
