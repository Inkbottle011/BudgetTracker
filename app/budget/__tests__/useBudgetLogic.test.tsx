import { renderHook, act, waitFor } from '@testing-library/react-native'
import { useBudgetLogic } from '../useBudgetLogic'
import { ToastContext } from '../../../context/ToastContext'
import { fake } from '../../../test/fakeSupabase'

jest.mock('../../../lib/supabase', () => require('../../../test/fakeSupabase').module)

const showToast = jest.fn()
const wrapper = ({ children }: any) => <ToastContext.Provider value={{ showToast }}>{children}</ToastContext.Provider>

const upserts = () => fake.calls('budget_amounts')
    .flatMap(c => c.ops.filter(o => o.method === 'upsert').map(o => o.args[0]))

async function setup() {
    const hook = await renderHook(() => useBudgetLogic(), { wrapper })
    await waitFor(() => expect(hook.result.current.loading).toBe(false))
    return hook
}

beforeEach(() => {
    fake.reset()
    showToast.mockClear()
    fake.table('budget_items', { data: [{ id: 'rent', name: 'Rent', type: 'expense' }, { id: 'pay', name: 'Pay', type: 'income' }] })
    fake.table('budget_amounts', { data: [{ budget_item_id: 'pay', month: 1, year: new Date().getFullYear(), amount: 5000 }] })
})

it('loads items and amounts for the year and totals them', async () => {
    const { result } = await setup()
    expect(result.current.items).toHaveLength(2)
    expect(result.current.getAmount('pay', 1)).toBe(5000)
    expect(result.current.getNetByMonth(1)).toBe(5000)
})

it.each([
    ['1,200', 1200],
    ['$1,200.50', 1200.5],
    ['900', 900],
    ['', 0],
])('saves a cell typed as %p as %p', async (typed, saved) => {
    const { result } = await setup()
    await act(() => result.current.handleCellSave('rent', 3, typed, false))
    expect(upserts()).toEqual([expect.objectContaining({ budget_item_id: 'rent', month: 3, amount: saved, user_id: 'user-1' })])
    expect(result.current.getAmount('rent', 3)).toBe(saved)
    expect(showToast).toHaveBeenCalledWith('Saved!')
})

it('"fill right" copies the value to the rest of the year', async () => {
    const { result } = await setup()
    await act(() => result.current.handleCellSave('rent', 10, '1,500', true))
    expect(upserts().map(u => [u.month, u.amount])).toEqual([[10, 1500], [11, 1500], [12, 1500]])
    expect(result.current.getRowTotal('rent')).toBe(4500)
})

it('reloads and reports when saving fails', async () => {
    const { result } = await setup()
    fake.table('budget_amounts', { error: { message: 'offline' } })
    await act(() => result.current.handleCellSave('rent', 1, '100', false))
    expect(showToast).toHaveBeenCalledWith('Failed to save', 'error')
})

it('adds and deletes budget items', async () => {
    const { result } = await setup()
    fake.table('budget_items', { data: { id: 'food', name: 'Food', type: 'expense' } })
    await act(() => result.current.setNewItemName('  Food  '))
    await act(() => result.current.setNewItemType('expense'))
    await act(() => result.current.handleAddItem())
    expect(fake.arg('budget_items', 'insert')).toEqual({ user_id: 'user-1', name: 'Food', type: 'expense' })
    expect(result.current.items.map(i => i.name)).toContain('Food')

    fake.table('budget_items', { data: null })
    await act(() => result.current.handleDeleteItem('pay'))
    expect(result.current.items.map(i => i.id)).not.toContain('pay')
    expect(result.current.getAmount('pay', 1)).toBe(0)
})

it('ignores a blank item name', async () => {
    const { result } = await setup()
    await act(() => result.current.handleAddItem())
    expect(fake.arg('budget_items', 'insert')).toBeUndefined()
})
