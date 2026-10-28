import { render, screen, fireEvent, act } from '@testing-library/react-native'
import BudgetScreen from '../screens/BudgetScreen'
import { ToastContext } from '../../../shared/ui/ToastContext'
import { fake } from '../../../../test/fakeSupabase'
import { useTransactionStore } from '../../transactions/api'

jest.mock('../../../shared/supabase', () => require('../../../../test/fakeSupabase').module)

const showToast = jest.fn()
const ops = (table: string, method: string) => fake.calls(table).flatMap(c => c.ops.filter(o => o.method === method).map(o => ({ args: o.args, call: c })))
const months = (id: string, amount: number) => Array.from({ length: 12 }, (_, i) => ({ budget_item_id: id, month: i + 1, year: 2026, amount }))
const tx = (id: string, date: string, name: string, amount: number) => ({ id, date, name, amount, type: 'expense', category_label: 'Food' })

beforeEach(() => {
    fake.reset()
    showToast.mockClear()
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
    jest.setSystemTime(new Date(2026, 9, 22, 12))
    fake.table('budget_items', call => {
        const insert = call.ops.find(o => o.method === 'insert')
        if (insert) return { data: { id: 'out', ...insert.args[0] }, error: null }
        if (call.ops.some(o => o.method === 'update')) return { data: null, error: null }
        return { data: [{ id: 'food', name: 'Food', type: 'expense' }, { id: 'rent', name: 'Rent', type: 'expense' }] }
    })
    fake.table('budget_amounts', call => call.ops.some(o => o.method === 'upsert') ? { data: null, error: null } : { data: [...months('food', 400), ...months('rent', 900)] })
    fake.table('transactions', { data: null, error: null })
    fake.table('subscriptions', { data: [] })
    useTransactionStore.setState({ transactions: [
        tx('g1', '2026-08-02', 'Giant', 80), tx('g2', '2026-09-02', 'Giant', 40),
        tx('t1', '2026-09-03', 'Taco Bell', 20), tx('o1', '2026-09-04', 'Owl Breakfast', 15),
        { id: 's1', date: '2026-09-04', name: 'Spotify', amount: 11, type: 'expense', category_label: 'Subscriptions' },
    ] as any })
})
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks() })

async function openSplit() {
    await render(<ToastContext.Provider value={{ showToast }}><BudgetScreen /></ToastContext.Provider>)
    await screen.findByText('Food')
    await fireEvent.press(screen.getByRole('button', { name: 'Change Food, $400 a month' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Split into two' }))
    expect(await screen.findByText('Split Food into two')).toBeTruthy()
}

it('splits Food into Groceries and Eating out: past purchases, the budget, and what comes next', async () => {
    await openSplit()
    expect(screen.getByLabelText('First new category').props.value).toBe('Groceries')
    expect(screen.getByLabelText('Second new category').props.value).toBe('Eating out')

    // Each place is sorted for you; ones we can't tell are marked
    expect(screen.getByRole('button', { name: 'Giant: Groceries' }).props.accessibilityState.selected).toBe(true)
    expect(screen.getByRole('button', { name: 'Taco Bell: Eating out' }).props.accessibilityState.selected).toBe(true)
    expect(screen.getByText('Not sure, check this one')).toBeTruthy()
    await fireEvent.press(screen.getByRole('button', { name: 'Owl Breakfast: Groceries' }))

    // The $400 a month is shared by what you really spend: 135 groceries, 20 eating out
    expect(screen.getByLabelText('Groceries per month').props.value).toBe('348')
    expect(screen.getByText('Eating out gets the other $52 a month')).toBeTruthy()
    await fireEvent.changeText(screen.getByLabelText('Groceries per month'), '300')
    expect(screen.getByText('Eating out gets the other $100 a month')).toBeTruthy()

    await fireEvent.press(screen.getByRole('button', { name: 'Split Food' }))

    const updates = ops('transactions', 'update').map(o => ({ category: o.args[0].category_label, ids: [...o.call.ops.find(x => x.method === 'in')!.args[1]].sort() }))
    expect(updates).toEqual([{ category: 'Groceries', ids: ['g1', 'g2', 'o1'] }, { category: 'Eating out', ids: ['t1'] }])
    expect(ops('budget_items', 'update').map(o => o.args[0])).toEqual([{ name: 'Groceries' }])
    expect(ops('budget_items', 'insert').map(o => o.args[0].name)).toEqual(['Eating out'])
    const rows = ops('budget_amounts', 'upsert')[0].args[0]
    expect(rows.filter((r: any) => r.budget_item_id === 'food').every((r: any) => r.amount === 300)).toBe(true)
    expect(rows.filter((r: any) => r.budget_item_id === 'out').every((r: any) => r.amount === 100)).toBe(true)
    expect(showToast).toHaveBeenCalledWith('Food is now Groceries and Eating out', 'success', expect.objectContaining({ label: 'Undo' }))
    expect(useTransactionStore.getState().transactions.find((t: any) => t.id === 't1')!.category_label).toBe('Eating out')
    expect(screen.queryByText('Split Food into two')).toBeNull()
})

it('needs two different names, and can be cancelled', async () => {
    await openSplit()
    await fireEvent.changeText(screen.getByLabelText('Second new category'), 'groceries')
    expect(screen.getByText('Give the two parts different names.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Split Food' }).props.accessibilityState.disabled).toBe(true)
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText('Split Food into two')).toBeNull()
    expect(ops('transactions', 'update')).toEqual([])
})

it('only spending can be split', async () => {
    fake.table('budget_items', { data: [{ id: 'pay', name: 'Pay', type: 'income' }] })
    fake.table('budget_amounts', { data: months('pay', 3000) })
    await render(<ToastContext.Provider value={{ showToast }}><BudgetScreen /></ToastContext.Provider>)
    await fireEvent.press(await screen.findByRole('button', { name: 'Change Pay, $3,000 a month' }))
    expect(screen.queryByRole('button', { name: 'Split into two' })).toBeNull()
})

it('Undo puts Food back: its purchases, its budget item and amounts', async () => {
    await openSplit()
    await fireEvent.press(screen.getByRole('button', { name: 'Split Food' }))
    const [message, , action] = showToast.mock.calls.at(-1)!
    expect([message, action.label]).toEqual(['Food is now Groceries and Eating out', 'Undo'])
    fake.reset()
    fake.table('budget_items', { data: [{ id: 'food', name: 'Food', type: 'expense' }, { id: 'rent', name: 'Rent', type: 'expense' }] })
    fake.table('budget_amounts', call => call.ops.some(o => o.method === 'upsert') ? { data: null } : { data: [...months('food', 400), ...months('rent', 900)] })
    fake.table('subscriptions', { data: [] })
    await act(async () => { await action.onPress() })

    const back = ops('transactions', 'update').map(o => ({ category: o.args[0].category_label, ids: [...o.call.ops.find(x => x.method === 'in')!.args[1]].sort() }))
    expect(back).toEqual([{ category: 'Food', ids: ['g1', 'g2', 'o1', 't1'] }])
    expect(ops('budget_items', 'update').map(o => o.args[0])).toEqual([{ name: 'Food' }])
    expect(ops('budget_items', 'delete')[0].call.ops).toContainEqual({ method: 'eq', args: ['id', 'out'] })
    const rows = ops('budget_amounts', 'upsert')[0].args[0]
    expect(rows.filter((r: any) => r.budget_item_id === 'food').map((r: any) => r.amount)).toEqual(Array(12).fill(400))
    expect(showToast).toHaveBeenLastCalledWith('Food is back')
})
