import { render, screen, fireEvent, within, act } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { light } from '../../../shared/theme/theme'
import TransactionsScreen from '../screens/TransactionsScreen'
import { ToastContext } from '../../../shared/ui/ToastContext'
import { useTransactionStore } from '../logic/useTransactionStore'
import { fake } from '../../../../test/fakeSupabase'

jest.mock('../../../shared/supabase', () => require('../../../../test/fakeSupabase').module)

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
// "Add transaction" is both the form's title and its button; the button comes last
const addButton = () => screen.getAllByText('Add transaction').at(-1)!
// The form's type buttons come after the list's summary bar, which also says "Income"
const typeButton = (t: string) => screen.getAllByText(t).at(-1)!

// The row comes before the totals underneath, which can show the same amount
const colorOf = (text: string) => StyleSheet.flatten(screen.getAllByText(text)[0].props.style).color
const deleteCalls = () => fake.calls('transactions').filter(c => c.ops.some(o => o.method === 'delete'))

/** A computer-sized window (the test default is phone-sized) */
function screenWidth(width: number) {
    jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({ width, height: 800, scale: 1, fontScale: 1 })
}

beforeEach(() => {
    screenWidth(1280)
    fake.reset()
    showToast.mockClear()
    useTransactionStore.setState({ transactions: [] })
    fake.table('transactions', { data: saved })
    fake.table('budget_items', { data: [] })
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
    jest.setSystemTime(new Date(2026, 9, 5, 21, 30)) // Oct 5, 9:30pm Eastern: already Oct 6 in UTC
})
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks() })

describe('list', () => {
    it('shows transactions newest first, without a running balance', async () => {
        await renderScreen()
        const names = screen.getAllByText(/^(Paycheck|Netflix|Groceries)$/).map(n => n.props.children)
        expect(names).toEqual(['Groceries', 'Netflix', 'Paycheck'])
        expect(screen.queryByText('Balance')).toBeNull()
        expect(screen.queryByText('$1901.91')).toBeNull()
    })

    it('reads dates like "Oct 2" and puts the category under the name', async () => {
        await renderScreen()
        expect(screen.getByText('Oct 2')).toBeTruthy()
        expect(screen.getByText('Food · weekly shop')).toBeTruthy()
    })

    it('colors amounts by direction: money in green with a plus, out with a minus, transfers grey with no sign', async () => {
        fake.table('transactions', { data: [...saved, { id: 't4', date: '2026-10-04', type: 'transfer', amount: 500, name: 'To savings account', note: '', category_label: '' }] })
        await renderScreen()
        expect(colorOf('+$2,000.00')).toBe(light.good)
        expect(colorOf('-$15.99')).toBe(light.ink)
        expect(colorOf('$500.00')).toBe(light.move)
    })

    it('shows the type as a badge', async () => {
        await renderScreen()
        expect(screen.getAllByText('Expense').length).toBeGreaterThanOrEqual(2) // two rows, plus the form's type choice
    })

    it('searches by name, note or category', async () => {
        await renderScreen()
        await fireEvent.changeText(screen.getByPlaceholderText('Search by name, category, or details...'), 'weekly')
        expect(screen.getByText('Groceries')).toBeTruthy()
        expect(screen.queryByText('Netflix')).toBeNull()
    })

    it('says when nothing matches the search', async () => {
        await renderScreen()
        await fireEvent.changeText(screen.getByPlaceholderText('Search by name, category, or details...'), 'zzz')
        expect(screen.getByText('Nothing matches')).toBeTruthy()
    })

    it('says what to do when there are no transactions yet', async () => {
        fake.table('transactions', { data: [] })
        await render(<ToastContext.Provider value={{ showToast }}><TransactionsScreen /></ToastContext.Provider>)
        expect(await screen.findByText('No transactions yet')).toBeTruthy()
        expect(screen.getByText('Add your first one, import a CSV, or link a bank in Settings.')).toBeTruthy()
    })

    it('filters by type', async () => {
        await renderScreen()
        await fireEvent.press(screen.getByText('Filter'))
        await fireEvent.press(within(screen.getByLabelText('Filters')).getByText('Income'))
        expect(screen.getByText('Paycheck')).toBeTruthy()
        expect(screen.queryByText('Netflix')).toBeNull()
        await fireEvent.press(screen.getByText('Clear filters'))
        expect(screen.getByText('Netflix')).toBeTruthy()
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

describe('editing', () => {
    it('tapping a row opens it for editing; there is no separate Edit mode', async () => {
        await renderScreen()
        expect(screen.queryByText('Edit')).toBeNull()
        await fireEvent.press(screen.getByText('Netflix'))
        expect(screen.getByText('Edit transaction')).toBeTruthy()
        expect(nameInput().props.value).toBe('Netflix')
    })

    it('edits a transaction with a flexible amount', async () => {
        await renderScreen()
        await fireEvent.press(screen.getByText('Netflix'))
        await fireEvent.changeText(amountInput(), '$17.99')
        await fireEvent.press(screen.getByText('Save changes'))
        expect(fake.arg('transactions', 'update')).toMatchObject({ amount: 17.99, date: '2026-10-02', name: 'Netflix' })
        const updateCall = fake.calls('transactions').find(c => c.ops.some(o => o.method === 'update'))!
        expect(updateCall.ops).toContainEqual({ method: 'eq', args: ['id', 't2'] })
    })

    it('refuses to save an edit with an unreadable amount', async () => {
        await renderScreen()
        await fireEvent.press(screen.getByText('Netflix'))
        await fireEvent.changeText(amountInput(), 'lots')
        await fireEvent.press(screen.getByText('Save changes'))
        expect(showToast).toHaveBeenCalledWith('Enter an amount, like 12.50', 'error')
        expect(fake.arg('transactions', 'update')).toBeUndefined()
    })

    it('Cancel goes back to adding', async () => {
        await renderScreen()
        await fireEvent.press(screen.getByText('Netflix'))
        await fireEvent.press(screen.getByText('Cancel'))
        expect(screen.queryByText('Edit transaction')).toBeNull()
        expect(nameInput().props.value).toBe('')
    })

    it('Duplicate adds a copy dated today', async () => {
        await renderScreen()
        await fireEvent.press(screen.getByText('Netflix'))
        await fireEvent.press(screen.getByText('Duplicate'))
        expect(fake.arg('transactions', 'insert')).toMatchObject({
            user_id: 'user-1', type: 'expense', amount: 15.99, name: 'Netflix', category_label: 'Entertainment', date: '2026-10-05',
        })
        expect(showToast).toHaveBeenCalledWith('Added a copy dated today')
        expect(screen.queryByText('Edit transaction')).toBeNull()
    })
})

describe('deleting', () => {
    it('deletes the selected transactions after confirming', async () => {
        await renderScreen()
        await fireEvent.press(screen.getByText('Select'))
        await fireEvent.press(screen.getByText('Netflix'))
        await fireEvent.press(screen.getByText('Groceries'))
        expect(screen.getByText('2 selected')).toBeTruthy()
        expect(screen.queryByText('Edit transaction')).toBeNull() // tapping selects instead of editing
        await fireEvent.press(screen.getByText('Delete 2'))
        expect(screen.getByText('Are you sure?')).toBeTruthy()
        expect(deleteCalls()).toHaveLength(0)
        await fireEvent.press(screen.getByText('Yes, delete 2'))
        expect(deleteCalls()[0].ops).toContainEqual({ method: 'in', args: ['id', ['t2', 't3']] })
        expect(showToast).toHaveBeenCalledWith('2 transactions deleted', 'success', expect.objectContaining({ label: 'Undo' }))
    })

    it('Undo puts deleted transactions back as they were, with who owes you and payback links', async () => {
        fake.table('split_shares', call => call.ops.some(o => o.method === 'upsert') ? { data: null } : { data: [{ id: 'sh1', expense_id: 't3', person: 'Sam', amount: 20, settled_by: null }] })
        fake.table('transactions', call => {
            if (call.ops.some(o => o.method === 'in' && o.args[0] === 'reimburses_id')) return { data: [{ id: 'pay1', reimburses_id: 't3' }] }
            if (call.ops.some(o => ['delete', 'insert', 'update'].includes(o.method))) return { data: null }
            return { data: saved }
        })
        await renderScreen()
        await fireEvent.press(screen.getByText('Select'))
        await fireEvent.press(screen.getByText('Groceries'))
        await fireEvent.press(screen.getByText('Delete 1'))
        await fireEvent.press(screen.getByText('Yes, delete 1'))
        const action = showToast.mock.calls.find(c => c[0] === '1 transaction deleted')![2]
        await act(async () => { await action.onPress() })

        const inserted = fake.calls('transactions').flatMap(c => c.ops.filter(o => o.method === 'insert').map(o => o.args[0]))[0]
        expect(inserted).toEqual([saved.find(t => t.id === 't3')])
        expect(fake.arg('split_shares', 'upsert')).toEqual([{ id: 'sh1', expense_id: 't3', person: 'Sam', amount: 20, settled_by: null }])
        const relink = fake.calls('transactions').find(c => c.ops.some(o => o.method === 'update'))!
        expect(relink.ops).toContainEqual({ method: 'update', args: [{ reimburses_id: 't3' }] })
        expect(relink.ops).toContainEqual({ method: 'in', args: ['id', ['pay1']] })
        expect(showToast).toHaveBeenLastCalledWith('The transaction is back')
    })

    it('tapping a selected row again unselects it, and nothing can be deleted with none selected', async () => {
        await renderScreen()
        await fireEvent.press(screen.getByText('Select'))
        await fireEvent.press(screen.getByText('Netflix'))
        await fireEvent.press(screen.getByText('Netflix'))
        expect(screen.getByText('0 selected')).toBeTruthy()
        expect(screen.queryByText(/^Delete \d/)).toBeNull()
    })

    it('Cancel leaves select mode, and taps edit again', async () => {
        await renderScreen()
        await fireEvent.press(screen.getByText('Select'))
        await fireEvent.press(screen.getByText('Netflix'))
        await fireEvent.press(screen.getByText('Cancel'))
        expect(screen.queryByText(/selected/)).toBeNull()
        await fireEvent.press(screen.getByText('Netflix'))
        expect(screen.getByText('Edit transaction')).toBeTruthy()
    })
})

describe('on a phone', () => {
    beforeEach(() => screenWidth(390))

    it('keeps the form out of the way until you press + Add', async () => {
        await renderScreen()
        expect(screen.queryByPlaceholderText('e.g. Grocery run, Netflix, Paycheck...')).toBeNull()
        await fireEvent.press(screen.getByText('+ Add'))
        expect(screen.getAllByText('Add transaction')).toHaveLength(2) // the sheet's title and its button
        await fireEvent.changeText(nameInput(), 'Coffee')
        await fireEvent.changeText(amountInput(), '4.50')
        await fireEvent.press(addButton())
        expect(fake.arg('transactions', 'insert')).toMatchObject({ name: 'Coffee', amount: 4.5 })
        expect(screen.queryByPlaceholderText('e.g. Grocery run, Netflix, Paycheck...')).toBeNull() // the sheet closed
    })

    it('Cancel closes the sheet without saving', async () => {
        await renderScreen()
        await fireEvent.press(screen.getByText('+ Add'))
        await fireEvent.press(screen.getByText('Cancel'))
        expect(screen.queryByPlaceholderText('e.g. Grocery run, Netflix, Paycheck...')).toBeNull()
        expect(fake.arg('transactions', 'insert')).toBeUndefined()
    })

    it('shows each transaction as a row: name, then category and date, with the amount', async () => {
        await renderScreen()
        expect(screen.getByText('Entertainment · Oct 2')).toBeTruthy()
        expect(screen.getByText('-$15.99')).toBeTruthy()
        expect(screen.queryByText('Amount')).toBeNull() // no table header
    })

    it('tapping a row opens it in the sheet for editing', async () => {
        await renderScreen()
        await fireEvent.press(screen.getByText('Netflix'))
        expect(screen.getByText('Edit transaction')).toBeTruthy()
        await fireEvent.changeText(amountInput(), '17.99')
        await fireEvent.press(screen.getByText('Save changes'))
        expect(fake.arg('transactions', 'update')).toMatchObject({ amount: 17.99 })
        expect(await screen.findByText('Netflix')).toBeTruthy()
        expect(screen.queryByText('Edit transaction')).toBeNull()
    })
})

describe('pending charges', () => {
    it('shows charges your bank hasn\'t posted yet, separately and marked pending', async () => {
        fake.table('bank_pending_transactions', { data: [
            { id: 'p1', date: '2026-10-05', amount: 12.5, money_in: false, name: 'Lunch Spot' },
            { id: 'p2', date: '2026-10-04', amount: 40, money_in: true, name: 'Refund' },
        ] })
        await renderScreen()
        expect(await screen.findByText('Pending at your bank (2)')).toBeTruthy()
        expect(screen.getByText('Lunch Spot')).toBeTruthy()
        expect(screen.getByText('-$12.50')).toBeTruthy()
        expect(screen.getByText('+$40.00')).toBeTruthy()
        expect(screen.getByText(/added to your list once your bank posts them/)).toBeTruthy()
    })

    it('shows nothing extra when there are none', async () => {
        await renderScreen()
        await screen.findByText('Transactions')
        expect(screen.queryByText(/Pending at your bank/)).toBeNull()
    })
})

it('privacy mode hides every amount in the list', async () => {
    const { usePrivacy } = require('../../../shared/ui/Private')
    usePrivacy.setState({ hidden: true, loaded: true })
    try {
        await renderScreen()
        expect(screen.queryAllByText(/\$\d/).map(t => [].concat(t.props.children).join(''))).toEqual([])
    } finally { usePrivacy.setState({ hidden: false }) }
})
