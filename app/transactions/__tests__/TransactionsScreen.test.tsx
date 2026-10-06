import { render, screen, fireEvent, within } from '@testing-library/react-native'
import TransactionsScreen from '../index'
import { ToastContext } from '../../../context/ToastContext'
import { useTransactionStore } from '../../../store/useTransactionStore'
import { fake } from '../../../test/fakeSupabase'

jest.mock('../../../lib/supabase', () => require('../../../test/fakeSupabase').module)

const saved = [
    { id: 't1', date: '2026-10-01', type: 'income', amount: 2000, name: 'Paycheck', note: '', category_label: 'Salary' },
    { id: 't2', date: '2026-10-02', type: 'expense', amount: 15.99, name: 'Netflix', note: '', category_label: 'Entertainment' },
    { id: 't3', date: '2026-10-03', type: 'expense', amount: 82.1, name: 'Groceries', note: 'weekly shop', category_label: 'Food' },
]

const showToast = jest.fn()

async function renderScreen() {
    await render(
        <ToastContext.Provider value={{ showToast }}>
            <TransactionsScreen />
        </ToastContext.Provider>,
    )
    await screen.findByText('Groceries')
}

const nameInput = () => screen.getByPlaceholderText('e.g. Grocery run, Netflix, Paycheck...')
const amountInput = () => screen.getByPlaceholderText('0.00')
const dateInput = () => screen.getByPlaceholderText('e.g. 10/5 or 2026-10-05')
// "Add Transaction" is both the form's title and its button; the button comes last
const addButton = () => screen.getAllByText('Add Transaction').at(-1)!
// The form's type buttons come after the list's summary bar, which also says "Income"
const typeButton = (t: string) => screen.getAllByText(t).at(-1)!

beforeEach(() => {
    fake.reset()
    showToast.mockClear()
    useTransactionStore.setState({ transactions: [] })
    fake.table('transactions', { data: saved })
    fake.table('budget_items', { data: [] })
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
    jest.setSystemTime(new Date(2026, 9, 5, 21, 30)) // Oct 5, 9:30pm Eastern: already Oct 6 in UTC
})
afterEach(() => jest.useRealTimers())

describe('list', () => {
    it('shows transactions newest first with a running balance', async () => {
        await renderScreen()
        const names = screen.getAllByText(/^(Paycheck|Netflix|Groceries)$/).map(n => n.props.children)
        expect(names).toEqual(['Groceries', 'Netflix', 'Paycheck'])
        expect(screen.getAllByText('$1901.91').length).toBeGreaterThan(0) // 2000 - 15.99 - 82.10
    })

    it('searches by name, note or category', async () => {
        await renderScreen()
        await fireEvent.changeText(screen.getByPlaceholderText('Search by name, category, or details...'), 'weekly')
        expect(screen.getByText('Groceries')).toBeTruthy()
        expect(screen.queryByText('Netflix')).toBeNull()
    })
})

describe('adding a transaction', () => {
    it('defaults to today\'s local date, not tomorrow\'s UTC date', async () => {
        await renderScreen()
        expect(dateInput().props.value).toBe('2026-10-05')
    })

    it('accepts amounts and dates the way people type them', async () => {
        await renderScreen()
        await fireEvent.changeText(nameInput(), 'Laptop')
        await fireEvent.changeText(amountInput(), '$1,234.50')
        await fireEvent.changeText(dateInput(), '10/4/2026')
        await fireEvent.press(addButton())
        expect(fake.arg('transactions', 'insert')).toMatchObject({
            user_id: 'user-1', name: 'Laptop', amount: 1234.5, date: '2026-10-04', type: 'expense',
        })
        expect(showToast).toHaveBeenCalledWith('Transaction added!')
    })

    it('keeps the type and date for the next entry and clears the rest', async () => {
        await renderScreen()
        await fireEvent.press(typeButton('Income'))
        await fireEvent.press(screen.getByText('Yesterday'))
        await fireEvent.changeText(nameInput(), 'Refund')
        await fireEvent.changeText(amountInput(), '20')
        await fireEvent.press(addButton())
        await screen.findByText('Transaction added!')
        expect(nameInput().props.value).toBe('')
        expect(amountInput().props.value).toBe('')
        expect(dateInput().props.value).toBe('2026-10-04')
        expect(fake.arg('transactions', 'insert')).toMatchObject({ type: 'income' })
    })

    it('saves when Enter is pressed in the amount field', async () => {
        await renderScreen()
        await fireEvent.changeText(amountInput(), '5')
        await fireEvent(amountInput(), 'submitEditing')
        expect(fake.arg('transactions', 'insert')).toMatchObject({ amount: 5 })
    })

    it.each([
        ['', 'Enter an amount, like 12.50'],
        ['abc', 'Enter an amount, like 12.50'],
        ['0', 'Enter an amount, like 12.50'],
    ])('rejects the amount %p', async (amount, message) => {
        await renderScreen()
        await fireEvent.changeText(amountInput(), amount)
        await fireEvent.press(addButton())
        expect(screen.getByText(message)).toBeTruthy()
        expect(fake.arg('transactions', 'insert')).toBeUndefined()
    })

    it('rejects a date it cannot read', async () => {
        await renderScreen()
        await fireEvent.changeText(amountInput(), '5')
        await fireEvent.changeText(dateInput(), '31/31/2026')
        await fireEvent.press(addButton())
        expect(screen.getByText('Use a date like 2026-10-05 or 10/5/2026')).toBeTruthy()
    })

    it('fills in amount, type and category from a past transaction with the same name', async () => {
        await renderScreen()
        await fireEvent(nameInput(), 'focus')
        await fireEvent.changeText(nameInput(), 'net')
        const suggestions = screen.getByText('Fill in from a past transaction').parent!
        await fireEvent.press(within(suggestions as any).getByText('Netflix'))
        expect(nameInput().props.value).toBe('Netflix')
        expect(amountInput().props.value).toBe('15.99')
        await fireEvent.press(addButton())
        expect(fake.arg('transactions', 'insert')).toMatchObject({
            name: 'Netflix', amount: 15.99, type: 'expense', category_label: 'Entertainment',
        })
    })

    it('tells the user when saving fails', async () => {
        await renderScreen()
        fake.table('transactions', { data: null, error: { message: 'offline' } })
        await fireEvent.changeText(amountInput(), '5')
        await fireEvent.press(addButton())
        expect(showToast).toHaveBeenCalledWith('Failed to add transaction', 'error')
    })
})

describe('editing and deleting', () => {
    it('edits a transaction with a flexible amount', async () => {
        await renderScreen()
        await fireEvent.press(screen.getByText('Edit'))
        await fireEvent.press(screen.getByText('Netflix'))
        expect(screen.getByText('Edit Transaction')).toBeTruthy()
        await fireEvent.changeText(amountInput(), '$17.99')
        await fireEvent.press(screen.getByText('Save Changes'))
        expect(fake.arg('transactions', 'update')).toMatchObject({ amount: 17.99, date: '2026-10-02', name: 'Netflix' })
        const updateCall = fake.calls('transactions').find(c => c.ops.some(o => o.method === 'update'))!
        expect(updateCall.ops).toContainEqual({ method: 'eq', args: ['id', 't2'] })
    })

    it('refuses to save an edit with an unreadable amount', async () => {
        await renderScreen()
        await fireEvent.press(screen.getByText('Edit'))
        await fireEvent.press(screen.getByText('Netflix'))
        await fireEvent.changeText(amountInput(), 'lots')
        await fireEvent.press(screen.getByText('Save Changes'))
        expect(showToast).toHaveBeenCalledWith('Enter an amount, like 12.50', 'error')
        expect(fake.arg('transactions', 'update')).toBeUndefined()
    })

    it('deletes the selected transactions after confirming', async () => {
        await renderScreen()
        await fireEvent.press(screen.getByText('Delete'))
        await fireEvent.press(screen.getByText('Netflix'))
        await fireEvent.press(screen.getByText('Groceries'))
        expect(screen.getByText('2 selected')).toBeTruthy()
        await fireEvent.press(screen.getByText('Delete'))
        expect(screen.getByText('Are you sure?')).toBeTruthy()
        expect(fake.calls('transactions').some(c => c.ops.some(o => o.method === 'delete'))).toBe(false)
        await fireEvent.press(screen.getByText('Confirm'))
        const del = fake.calls('transactions').find(c => c.ops.some(o => o.method === 'delete'))!
        expect(del.ops).toContainEqual({ method: 'in', args: ['id', ['t2', 't3']] })
        expect(showToast).toHaveBeenCalledWith('2 transactions deleted')
    })
})
