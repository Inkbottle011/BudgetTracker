import { render, screen, fireEvent } from '@testing-library/react-native'
import BudgetScreen from '../index'
import { ToastContext } from '../../../context/ToastContext'
import { fake } from '../../../test/fakeSupabase'

jest.mock('../../../lib/supabase', () => require('../../../test/fakeSupabase').module)

const showToast = jest.fn()
const year = new Date().getFullYear()

async function renderScreen() {
    await render(<ToastContext.Provider value={{ showToast }}><BudgetScreen /></ToastContext.Provider>)
    await screen.findByText('Rent')
}

const upserts = () => fake.calls('budget_amounts').flatMap(c => c.ops.filter(o => o.method === 'upsert').map(o => o.args[0]))

beforeEach(() => {
    fake.reset()
    showToast.mockClear()
    fake.table('budget_items', { data: [{ id: 'rent', name: 'Rent', type: 'expense' }, { id: 'pay', name: 'Pay', type: 'income' }] })
    fake.table('budget_amounts', { data: [{ budget_item_id: 'pay', month: 1, year, amount: 5000 }] })
})

it('shows items with their amounts and the net per month', async () => {
    await renderScreen()
    expect(screen.getAllByText('$5,000').length).toBeGreaterThan(0)
    expect(screen.getByText('Net')).toBeTruthy()
})

it('edits one month, accepting "1,200"', async () => {
    await renderScreen()
    await fireEvent.press(screen.getByLabelText('Rent, Mar'))
    await fireEvent.changeText(screen.getByLabelText('Rent, Mar amount'), '1,200')
    await fireEvent.press(screen.getByLabelText('Save this month only'))
    expect(upserts()).toEqual([expect.objectContaining({ budget_item_id: 'rent', month: 3, year, amount: 1200 })])
    expect(screen.getAllByText('$1,200').length).toBeGreaterThan(0)
})

it('fills a value across the rest of the year', async () => {
    await renderScreen()
    await fireEvent.press(screen.getByLabelText('Rent, Oct'))
    await fireEvent.changeText(screen.getByLabelText('Rent, Oct amount'), '1500')
    await fireEvent.press(screen.getByLabelText('Fill this month and all months to the right'))
    expect(upserts().map(u => u.month)).toEqual([10, 11, 12])
    expect(screen.getAllByText('$4,500').length).toBeGreaterThan(0) // row total and section total
    expect(showToast).toHaveBeenCalledWith('Filled right!')
})

it('cancels an edit without saving', async () => {
    await renderScreen()
    await fireEvent.press(screen.getByLabelText('Rent, Mar'))
    await fireEvent.press(screen.getByLabelText('Cancel'))
    expect(screen.queryByLabelText('Rent, Mar amount')).toBeNull()
    expect(upserts()).toEqual([])
})

it('adds and deletes items', async () => {
    await renderScreen()
    await fireEvent.press(screen.getByText(/\+ Add Savings/))
    await fireEvent.changeText(screen.getByPlaceholderText('Name...'), 'Roth IRA')
    fake.table('budget_items', { data: { id: 'ira', name: 'Roth IRA', type: 'savings' } })
    await fireEvent.press(screen.getByText('Add'))
    expect(fake.arg('budget_items', 'insert')).toEqual({ user_id: 'user-1', name: 'Roth IRA', type: 'savings' })
    expect(await screen.findByText('Roth IRA')).toBeTruthy()

    fake.table('budget_items', { data: null })
    await fireEvent.press(screen.getByLabelText('Delete Rent'))
    expect(screen.queryByText('Rent')).toBeNull()
})

it('moves between years', async () => {
    await renderScreen()
    await fireEvent.press(screen.getByLabelText('Next year'))
    expect(await screen.findByText(String(year + 1))).toBeTruthy()
    const amountsCall = fake.calls('budget_amounts').at(-1)!
    expect(amountsCall.ops).toContainEqual({ method: 'eq', args: ['year', year + 1] })
})
