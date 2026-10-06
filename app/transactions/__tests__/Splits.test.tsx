import { render, screen, fireEvent, within } from '@testing-library/react-native'
import TransactionsScreen from '../index'
import { ToastContext } from '../../../context/ToastContext'
import { useTransactionStore } from '../../../store/useTransactionStore'
import { fake } from '../../../test/fakeSupabase'

jest.mock('../../../lib/supabase', () => require('../../../test/fakeSupabase').module)

const showToast = jest.fn()

const saved = [
    { id: 'dinner', date: '2026-09-30', type: 'expense', amount: 120, name: 'Dinner', note: '', category_label: 'Food' },
    { id: 'venmo-cashout', date: '2026-10-02', type: 'income', amount: 30, name: 'VENMO CASHOUT', note: '', category_label: '' },
    { id: 'pay', date: '2026-10-01', type: 'income', amount: 2000, name: 'Paycheck', note: '', category_label: 'Salary' },
]
let shares: any[]

/** Fake database: transactions and split_shares, with ids handed back for inserts. */
function database() {
    fake.table('budget_items', { data: [] })
    fake.table('transactions', call => {
        const insert = call.ops.find(o => o.method === 'insert')
        if (insert) return { data: { id: `new-${insert.args[0].type}` }, error: null }
        return { data: saved, error: null }
    })
    fake.table('split_shares', call => {
        if (call.ops.some(o => o.method === 'insert' || o.method === 'update' || o.method === 'delete')) return { data: null, error: null }
        return { data: shares, error: null }
    })
}

const ops = (table: string, method: string) =>
    fake.calls(table).flatMap(c => c.ops.filter(o => o.method === method).map(o => ({ args: o.args, call: c })))

async function renderScreen() {
    await render(<ToastContext.Provider value={{ showToast }}><TransactionsScreen /></ToastContext.Provider>)
    await screen.findByText('Paycheck')
}

const amountInput = () => screen.getByPlaceholderText('0.00')
const addButton = () => screen.getAllByText('Add Transaction').at(-1)!

beforeEach(() => {
    fake.reset()
    showToast.mockClear()
    useTransactionStore.setState({ transactions: [] })
    shares = []
    database()
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
    jest.setSystemTime(new Date(2026, 9, 5, 12))
})
afterEach(() => jest.useRealTimers())

describe('splitting an expense', () => {
    async function startSplit(amount = '120') {
        await renderScreen()
        await fireEvent.changeText(screen.getByPlaceholderText('e.g. Grocery run, Netflix, Paycheck...'), 'Dinner')
        await fireEvent.changeText(amountInput(), amount)
        await fireEvent.press(screen.getByText('+ Split with others'))
    }

    it('records the full expense and who owes you', async () => {
        await startSplit()
        await fireEvent.changeText(screen.getByLabelText('Person 1 name'), 'Sam')
        await fireEvent.changeText(screen.getByLabelText('Person 1 owes'), '30')
        await fireEvent.press(screen.getByText('+ Add person'))
        await fireEvent.changeText(screen.getByLabelText('Person 2 name'), 'Alex')
        await fireEvent.changeText(screen.getByLabelText('Person 2 owes'), '$60')
        expect(screen.getByText('Others owe you $90.00 · your share $30.00')).toBeTruthy()

        await fireEvent.press(addButton())
        expect(ops('transactions', 'insert')[0].args[0]).toMatchObject({ type: 'expense', amount: 120, name: 'Dinner' })
        expect(ops('split_shares', 'insert')[0].args[0]).toEqual([
            { expense_id: 'new-expense', person: 'Sam', amount: 30 },
            { expense_id: 'new-expense', person: 'Alex', amount: 60 },
        ])
        expect(showToast).toHaveBeenCalledWith('Transaction added! $90.00 is owed to you.')
        expect(screen.queryByLabelText('Person 1 name')).toBeNull()
    })

    it('splits evenly between you and everyone listed', async () => {
        await startSplit('100')
        await fireEvent.changeText(screen.getByLabelText('Person 1 name'), 'Sam')
        await fireEvent.press(screen.getByText('+ Add person'))
        await fireEvent.changeText(screen.getByLabelText('Person 2 name'), 'Alex')
        await fireEvent.press(screen.getByText('Split evenly'))
        expect(screen.getByLabelText('Person 1 owes').props.value).toBe('33.33')
        expect(screen.getByLabelText('Person 2 owes').props.value).toBe('33.33')
        expect(screen.getByText('Others owe you $66.66 · your share $33.34')).toBeTruthy()
    })

    it('will not let others owe more than the total', async () => {
        await startSplit('50')
        await fireEvent.changeText(screen.getByLabelText('Person 1 name'), 'Sam')
        await fireEvent.changeText(screen.getByLabelText('Person 1 owes'), '60')
        await fireEvent.press(addButton())
        expect(screen.getByText("Others can't owe more than the total")).toBeTruthy()
        expect(ops('transactions', 'insert')).toHaveLength(0)
    })

    it('needs a name for each amount', async () => {
        await startSplit()
        await fireEvent.changeText(screen.getByLabelText('Person 1 owes'), '30')
        await fireEvent.press(addButton())
        expect(screen.getByText('Add a name for each person')).toBeTruthy()
    })

    it('ignores an empty split and saves a normal expense', async () => {
        await startSplit()
        await fireEvent.press(addButton())
        expect(ops('transactions', 'insert')).toHaveLength(1)
        expect(ops('split_shares', 'insert')).toHaveLength(0)
    })

    it('only offers splitting for expenses', async () => {
        await renderScreen()
        await fireEvent.press(screen.getAllByText('Income').at(-1)!)
        expect(screen.queryByText('+ Split with others')).toBeNull()
    })

    it('records money paid back to you as a Reimbursement, using expense categories', async () => {
        await renderScreen()
        await fireEvent.press(screen.getAllByText('Reimbursement').at(-1)!)
        await fireEvent.press(screen.getAllByText('Food').at(-1)!) // the form's category button, not the list
        await fireEvent.changeText(amountInput(), '15')
        await fireEvent.press(addButton())
        expect(ops('transactions', 'insert')[0].args[0]).toMatchObject({ type: 'reimbursement', amount: 15, category_label: 'Food' })
    })
})

describe('owed to you', () => {
    beforeEach(() => {
        shares = [
            { id: 's-sam', expense_id: 'dinner', person: 'Sam', amount: 30, settled_by: null },
            { id: 's-alex', expense_id: 'dinner', person: 'Alex', amount: 60, settled_by: null },
            { id: 's-jo', expense_id: 'dinner', person: 'Jo', amount: 30, settled_by: 'old-payback' },
        ]
    })

    const panel = async () => {
        await renderScreen()
        await fireEvent.press(await screen.findByText('Owed to you: $90.00'))
        return screen.getByLabelText('Owed to you')
    }

    it('shows who still owes you, per expense', async () => {
        const p = await panel()
        expect(within(p).getByText(/Dinner/)).toBeTruthy()
        expect(within(p).getByText('Sam')).toBeTruthy()
        expect(within(p).getByText('Alex')).toBeTruthy()
        expect(within(p).queryByText('Jo')).toBeNull()
    })

    it('marking someone paid records a reimbursement linked to the expense', async () => {
        const p = await panel()
        await fireEvent.press(within(p).getByLabelText('Alex paid'))
        expect(ops('transactions', 'insert')[0].args[0]).toMatchObject({
            type: 'reimbursement', amount: 60, category_label: 'Food', reimburses_id: 'dinner', date: '2026-10-05', name: 'Alex paid back',
        })
        const update = ops('split_shares', 'update')[0]
        expect(update.args[0]).toEqual({ settled_by: 'new-reimbursement' })
        expect(update.call.ops).toContainEqual({ method: 'eq', args: ['id', 's-alex'] })
        expect(showToast).toHaveBeenCalledWith('Alex paid you back $60.00')
    })

    it('can use a deposit you already imported instead, so it is not counted twice', async () => {
        const p = await panel()
        await fireEvent.press(within(p).getByLabelText('Use VENMO CASHOUT on 2026-10-02 for Sam'))
        expect(ops('transactions', 'insert')).toHaveLength(0)
        const update = ops('transactions', 'update')[0]
        expect(update.args[0]).toEqual({ type: 'reimbursement', category_label: 'Food', reimburses_id: 'dinner' })
        expect(update.call.ops).toContainEqual({ method: 'eq', args: ['id', 'venmo-cashout'] })
        expect(ops('split_shares', 'update')[0].args[0]).toEqual({ settled_by: 'venmo-cashout' })
    })

    it('can forget a share someone will not pay', async () => {
        const p = await panel()
        await fireEvent.press(within(p).getByLabelText('Forget what Sam owes'))
        const del = ops('split_shares', 'delete')[0]
        expect(del.call.ops).toContainEqual({ method: 'eq', args: ['id', 's-sam'] })
    })

    it('says nothing is owed when everyone has paid', async () => {
        shares = [{ id: 's-jo', expense_id: 'dinner', person: 'Jo', amount: 30, settled_by: 'x' }]
        await renderScreen()
        expect(screen.queryByText(/Owed to you:/)).toBeNull()
    })

    it('tells you if recording a payback fails', async () => {
        const p = await panel()
        fake.table('transactions', { data: null, error: { message: 'offline' } })
        await fireEvent.press(within(p).getByLabelText('Sam paid'))
        expect(showToast).toHaveBeenCalledWith("Couldn't record that payment: offline", 'error')
        expect(ops('split_shares', 'update')).toHaveLength(0)
    })
})
