import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { UncategorizedPanel } from '../UncategorizedPanel'
import { ToastContext } from '../../../context/ToastContext'
import { fake } from '../../../test/fakeSupabase'

jest.mock('../../../lib/supabase', () => require('../../../test/fakeSupabase').module)

const showToast = jest.fn()
const onChanged = jest.fn()
const categories = { Income: ['Salary'], Expense: ['Food', 'Entertainment', 'Subscriptions'], Savings: [], Investment: [] }

const tx = (id: string, name: string, amount: number, type = 'expense', category_label = '') =>
    ({ id, name, amount, type, category_label, date: '2026-09-01', note: '' })

const list = [
    tx('1', 'TACOS TEXAS', 12.31), tx('2', 'TACOS TEXAS', 14.55),
    tx('3', 'Fandango', 43.38),
    tx('4', 'FABI KIOSK --720463', 408.99),
    tx('5', 'Wawa', 8.63, 'expense', 'Food'),
    tx('6', 'To Car Vault', 100, 'transfer'),
]

const updates = () => fake.calls('transactions').filter(c => c.ops.some(o => o.method === 'update'))
    .map(c => [c.ops.find(o => o.method === 'update')!.args[0].category_label, c.ops.find(o => o.method === 'in')!.args[1]])

async function renderPanel(transactions = list) {
    await render(<ToastContext.Provider value={{ showToast }}>
        <UncategorizedPanel transactions={transactions} budgetCategories={categories} onChanged={onChanged} />
    </ToastContext.Provider>)
}

beforeEach(() => {
    fake.reset()
    showToast.mockClear(); onChanged.mockClear()
    fake.table('transactions', { data: null, error: null })
})

it('stays out of the way when everything has a category', async () => {
    await renderPanel([tx('5', 'Wawa', 8.63, 'expense', 'Food'), tx('6', 'To Car Vault', 100, 'transfer')])
    expect(screen.queryByText(/without a category/)).toBeNull()
})

it('says how many transactions need a category, grouped by place', async () => {
    await renderPanel()
    expect(screen.getByText('4 transactions without a category (3 places)')).toBeTruthy()
    await fireEvent.press(screen.getByText('Review'))
    expect(screen.getByText('TACOS TEXAS')).toBeTruthy()
    expect(screen.getByText('2 × · $26.86')).toBeTruthy()
})

it('applies the suggested category to every transaction from that place', async () => {
    await renderPanel()
    await fireEvent.press(screen.getByText('Review'))
    await fireEvent.press(screen.getByLabelText('Use Food for TACOS TEXAS'))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(updates()).toEqual([['Food', ['1', '2']]])
    expect(showToast).toHaveBeenCalledWith('2 TACOS TEXAS transactions set to Food. New ones will be too.')
})

it('lets you pick a different category', async () => {
    await renderPanel()
    await fireEvent.press(screen.getByText('Review'))
    await fireEvent.press(screen.getByLabelText('Choose a category for FABI KIOSK --720463'))
    await fireEvent.press(screen.getByLabelText('Use Entertainment for FABI KIOSK --720463'))
    await waitFor(() => expect(updates()).toEqual([['Entertainment', ['4']]]))
})

it('applies every suggestion at once', async () => {
    await renderPanel()
    await fireEvent.press(screen.getByText('Review'))
    await fireEvent.press(screen.getByText('Apply all 2 suggestions'))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(updates().sort()).toEqual([['Entertainment', ['3']], ['Food', ['1', '2']]])
    expect(showToast).toHaveBeenCalledWith('Categorized 3 transactions')
})

it('says why saving failed', async () => {
    fake.table('transactions', { data: null, error: { message: 'permission denied' } })
    await renderPanel()
    await fireEvent.press(screen.getByText('Review'))
    await fireEvent.press(screen.getByLabelText('Use Food for TACOS TEXAS'))
    await waitFor(() => expect(showToast).toHaveBeenCalledWith("Couldn't save categories: permission denied", 'error'))
    expect(onChanged).not.toHaveBeenCalled()
})
