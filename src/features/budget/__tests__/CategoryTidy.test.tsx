import { render, screen, fireEvent, act, within } from '@testing-library/react-native'
import BudgetScreen from '../screens/BudgetScreen'
import { ToastContext } from '../../../shared/ui/ToastContext'
import { fake } from '../../../../test/fakeSupabase'
import { useTransactionStore } from '../../transactions/api'

jest.mock('../../../shared/supabase', () => require('../../../../test/fakeSupabase').module)

const showToast = jest.fn()
const ops = (table: string, method: string) => fake.calls(table).flatMap(c => c.ops.filter(o => o.method === method).map(o => ({ args: o.args, call: c })))
const months = (id: string, amount: number) => Array.from({ length: 12 }, (_, i) => ({ budget_item_id: id, month: i + 1, year: 2026, amount }))
const tx = (id: string, category_label: string, type = 'expense') => ({ id, date: '2026-10-02', name: `t${id}`, amount: 5, type, category_label })
const moved = () => ops('transactions', 'update').map(o => ({ to: o.args[0].category_label, ids: [...o.call.ops.find(x => x.method === 'in')!.args[1]].sort() }))
const lastUndo = () => showToast.mock.calls.at(-1)![2]

const transactions = [tx('1', 'Food'), tx('2', 'food', 'reimbursement'), tx('3', 'Eating out'), tx('4', 'Subscribtions'), tx('5', 'Subscribtions'), tx('6', 'Food', 'income')]

beforeEach(() => {
    fake.reset()
    showToast.mockClear()
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
    jest.setSystemTime(new Date(2026, 9, 22, 12))
    let n = 0
    fake.table('budget_items', call => {
        const insert = call.ops.find(o => o.method === 'insert')
        if (insert) return { data: { id: `new-${++n}`, ...insert.args[0] }, error: null }
        if (call.ops.some(o => o.method === 'update' || o.method === 'delete')) return { data: null, error: null }
        return { data: [
            { id: 'food', name: 'Food', type: 'expense', user_id: 'user-1' },
            { id: 'out', name: 'Eating out', type: 'expense', user_id: 'user-1' },
            { id: 'subs', name: 'Subscriptions', type: 'expense', user_id: 'user-1' },
        ] }
    })
    fake.table('budget_amounts', call => call.ops.some(o => o.method === 'upsert') ? { data: null } : { data: [...months('food', 300), ...months('out', 100), ...months('subs', 60)] })
    fake.table('transactions', call => call.ops.some(o => o.method === 'update') ? { data: null } : { data: transactions })
    fake.table('subscriptions', call => call.ops.some(o => o.method === 'update') ? { data: null } : { data: [{ id: 'meal', name: 'Meal kit', category_label: 'Food' }] })
    useTransactionStore.setState({ transactions: transactions as any })
})
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks() })

async function openRename(name: string, amount: string) {
    await render(<ToastContext.Provider value={{ showToast }}><BudgetScreen /></ToastContext.Provider>)
    await fireEvent.press(await screen.findByRole('button', { name: `Change ${name}, ${amount} a month` }))
    await fireEvent.press(screen.getByRole('button', { name: 'Rename' }))
    expect(screen.getByText(`Rename ${name}`)).toBeTruthy()
}

it('renaming a category moves its transactions and subscriptions too, with Undo', async () => {
    await openRename('Food', '$300')
    await fireEvent.changeText(screen.getByLabelText('New name'), 'Groceries')
    await fireEvent.press(screen.getByRole('button', { name: 'Rename' }))
    expect(ops('budget_items', 'update').map(o => o.args[0])).toEqual([{ name: 'Groceries' }])
    expect(moved()).toEqual([{ to: 'Groceries', ids: ['1', '2'] }])   // spending and paybacks, not income
    expect(ops('subscriptions', 'update').map(o => o.args[0])).toEqual([{ category_label: 'Groceries' }])
    expect(showToast.mock.calls.at(-1)!.slice(0, 2)).toEqual(['Food is now called Groceries', 'success'])

    const undo = lastUndo()
    fake.reset()
    fake.table('budget_items', { data: [] })
    await act(async () => { await undo.onPress() })
    expect(ops('budget_items', 'update').map(o => o.args[0])).toEqual([{ name: 'Food' }])
    expect(moved()).toEqual([{ to: 'Food', ids: ['1', '2'] }])
    expect(ops('subscriptions', 'update').map(o => o.args[0])).toEqual([{ category_label: 'Food' }])
    expect(showToast).toHaveBeenLastCalledWith('Food is back')
})

it('renaming to a category you already have combines them, with Undo', async () => {
    await openRename('Food', '$300')
    await fireEvent.changeText(screen.getByLabelText('New name'), 'eating out')
    expect(screen.getByText(/You already have Eating out/)).toBeTruthy()
    await fireEvent.press(screen.getByRole('button', { name: 'Combine into Eating out' }))
    expect(moved()).toEqual([{ to: 'Eating out', ids: ['1', '2'] }])
    const rows = ops('budget_amounts', 'upsert')[0].args[0]
    expect(rows.filter((r: any) => r.budget_item_id === 'out').map((r: any) => r.amount)).toEqual(Array(12).fill(400))
    expect(ops('budget_items', 'delete')[0].call.ops).toContainEqual({ method: 'eq', args: ['id', 'food'] })
    expect(showToast.mock.calls.at(-1)![0]).toBe('Food is now part of Eating out')

    const undo = lastUndo()
    fake.reset()
    fake.table('budget_items', { data: [] })
    await act(async () => { await undo.onPress() })
    expect(ops('budget_items', 'insert')[0].args[0]).toEqual(expect.objectContaining({ id: 'food', name: 'Food' }))
    const back = ops('budget_amounts', 'upsert').flatMap(o => o.args[0])
    expect(back.filter((r: any) => r.budget_item_id === 'food').map((r: any) => r.amount)).toEqual(Array(12).fill(300))
    expect(back.filter((r: any) => r.budget_item_id === 'out').map((r: any) => r.amount)).toEqual(Array(12).fill(100))
    expect(moved()).toEqual([{ to: 'Food', ids: ['1', '2'] }])
})

it('finds categories in your transactions that are not in your budget, and tidies them', async () => {
    await render(<ToastContext.Provider value={{ showToast }}><BudgetScreen /></ToastContext.Provider>)
    const card = within(await screen.findByLabelText('Categories not in your budget'))
    expect(card.getByText('Subscribtions')).toBeTruthy()
    expect(card.getByText('2 transactions')).toBeTruthy()
    await fireEvent.press(card.getByRole('button', { name: 'Move Subscribtions to…' }))
    await fireEvent.press(card.getByRole('button', { name: 'Subscriptions' }))
    expect(moved()).toEqual([{ to: 'Subscriptions', ids: ['4', '5'] }])
    expect(showToast.mock.calls.at(-1)![0]).toBe('Moved 2 transactions to Subscriptions')
    await act(async () => { await lastUndo().onPress() })
    expect(moved().at(-1)).toEqual({ to: 'Subscribtions', ids: ['4', '5'] })
})

it('or adds one to your budget', async () => {
    await render(<ToastContext.Provider value={{ showToast }}><BudgetScreen /></ToastContext.Provider>)
    const card = within(await screen.findByLabelText('Categories not in your budget'))
    await fireEvent.press(card.getByRole('button', { name: 'Add Subscribtions to your budget' }))
    expect(ops('budget_items', 'insert')[0].args[0]).toEqual({ user_id: 'user-1', name: 'Subscribtions', type: 'expense' })
})
