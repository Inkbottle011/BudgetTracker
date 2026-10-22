import { render, screen, fireEvent, act } from '@testing-library/react-native'
import BudgetScreen from '../screens/BudgetScreen'
import { ToastContext } from '../../../shared/ui/ToastContext'
import { fake } from '../../../../test/fakeSupabase'

jest.mock('../../../shared/supabase', () => require('../../../../test/fakeSupabase').module)

const showToast = jest.fn()
const ops = (table: string, method: string) => fake.calls(table).flatMap(c => c.ops.filter(o => o.method === method).map(o => ({ args: o.args, call: c })))
const yearOf = (call: any) => call.ops.find((o: any) => o.method === 'eq' && o.args[0] === 'year')?.args[1]
const rows2026 = [
    ...Array.from({ length: 12 }, (_, i) => ({ id: `r${i}`, user_id: 'user-1', budget_item_id: 'rent', month: i + 1, year: 2026, amount: 900 })),
    { id: 'p1', user_id: 'user-1', budget_item_id: 'pay', month: 1, year: 2026, amount: 3000 },
]

beforeEach(() => {
    fake.reset()
    showToast.mockClear()
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
    jest.setSystemTime(new Date(2026, 9, 22, 12))
    fake.table('budget_items', { data: [{ id: 'rent', name: 'Rent', type: 'expense' }, { id: 'pay', name: 'Pay', type: 'income' }] })
    fake.table('budget_amounts', call => {
        if (call.ops.some(o => o.method === 'upsert' || o.method === 'delete')) return { data: null, error: null }
        return { data: yearOf(call) === 2026 ? rows2026 : [] }
    })
})
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks() })

it('an empty year offers to copy the year before, with Undo', async () => {
    await render(<ToastContext.Provider value={{ showToast }}><BudgetScreen /></ToastContext.Provider>)
    await screen.findByText('Rent')
    expect(screen.queryByText('Nothing planned for 2026 yet')).toBeNull()   // this year has a plan
    await fireEvent.press(screen.getByLabelText('Next year'))
    expect(await screen.findByText('Nothing planned for 2027 yet')).toBeTruthy()
    await fireEvent.press(screen.getByRole('button', { name: "Copy 2026's budget" }))

    const copied = ops('budget_amounts', 'upsert')[0].args[0]
    expect(copied).toHaveLength(13)
    expect(copied[0]).toEqual({ user_id: 'user-1', budget_item_id: 'rent', month: 1, year: 2027, amount: 900 })
    const [message, , action] = showToast.mock.calls.at(-1)!
    expect(message).toBe("Copied 2026's budget into 2027")
    expect(await screen.findByRole('button', { name: 'Change Rent, $900 a month' })).toBeTruthy()

    await act(async () => { await action.onPress() })
    const del = ops('budget_amounts', 'delete')[0].call.ops
    expect(del).toContainEqual({ method: 'eq', args: ['year', 2027] })
    expect(del).toContainEqual({ method: 'in', args: ['budget_item_id', ['rent', 'pay']] })
})
