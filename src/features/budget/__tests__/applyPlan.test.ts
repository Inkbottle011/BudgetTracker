import { applyPlan, setEveryMonth, splitBudgetItem } from '../logic/data'
import { fake } from '../../../../test/fakeSupabase'

jest.mock('../../../shared/supabase', () => require('../../../../test/fakeSupabase').module)

const ops = (table: string, method: string) =>
    fake.calls(table).flatMap(c => c.ops.filter(o => o.method === method).map(o => ({ args: o.args, call: c })))

beforeEach(() => {
    fake.reset()
    let n = 0
    fake.table('budget_items', call => {
        const insert = call.ops.find(o => o.method === 'insert')
        return insert ? { data: { id: `new-${++n}`, ...insert.args[0] }, error: null } : { data: [], error: null }
    })
    fake.table('budget_amounts', { data: null, error: null })
})

const existing = [{ id: 'rent-id', name: 'Rent', type: 'expense' }, { id: 'food-id', name: 'Food', type: 'expense' }]

it('adds new items, reuses ones with the same name, and sets amounts for the chosen months', async () => {
    const result = await applyPlan({
        year: 2026, fromMonth: 11, existing,
        items: [{ name: 'Cafe', type: 'income', monthly: 1950 }, { name: 'rent', type: 'expense', monthly: 900 }],
    })
    expect(result).toEqual({ added: 1, updated: 1 })
    expect(ops('budget_items', 'insert').map(o => o.args[0])).toEqual([{ user_id: 'user-1', name: 'Cafe', type: 'income' }])
    const rows = ops('budget_amounts', 'upsert')[0].args[0]
    expect(rows).toEqual([
        { user_id: 'user-1', budget_item_id: 'new-1', month: 11, year: 2026, amount: 1950 },
        { user_id: 'user-1', budget_item_id: 'new-1', month: 12, year: 2026, amount: 1950 },
        { user_id: 'user-1', budget_item_id: 'rent-id', month: 11, year: 2026, amount: 900 },
        { user_id: 'user-1', budget_item_id: 'rent-id', month: 12, year: 2026, amount: 900 },
    ])
    expect(ops('budget_amounts', 'upsert')[0].args[1]).toEqual({ onConflict: 'budget_item_id,month,year' })
})

it('never deletes anything', async () => {
    await applyPlan({ year: 2026, fromMonth: 1, existing, items: [] })
    expect(ops('budget_items', 'delete')).toEqual([])
    expect(ops('budget_amounts', 'delete')).toEqual([])
})

it('says what went wrong if saving fails', async () => {
    fake.table('budget_amounts', { data: null, error: { message: 'no access' } })
    await expect(applyPlan({ year: 2026, fromMonth: 1, existing, items: [{ name: 'Rent', type: 'expense', monthly: 1 }] }))
        .rejects.toThrow("Couldn't save your plan: no access")
})

it('setEveryMonth sets one amount for all twelve months, in one request', async () => {
    await setEveryMonth('rent-id', 2026, 950)
    const rows = ops('budget_amounts', 'upsert')[0].args[0]
    expect(rows).toHaveLength(12)
    expect(rows[0]).toEqual({ user_id: 'user-1', budget_item_id: 'rent-id', month: 1, year: 2026, amount: 950 })
    expect(rows[11].month).toBe(12)
})

describe('splitBudgetItem', () => {
    const food = { id: 'food-id', name: 'Food', type: 'expense' }
    beforeEach(() => {
        let n = 0
        fake.table('budget_items', call => {
            const insert = call.ops.find(o => o.method === 'insert')
            return insert ? { data: { id: `new-${++n}`, ...insert.args[0] }, error: null } : { data: null, error: null }
        })
        fake.table('budget_amounts', call => call.ops.some(o => o.method === 'upsert') ? { data: null, error: null } : { data: [
            { budget_item_id: 'food-id', year: 2026, month: 1, amount: 400 },
            { budget_item_id: 'food-id', year: 2026, month: 2, amount: 401 },
            { budget_item_id: 'food-id', year: 2025, month: 12, amount: 300 },
        ], error: null })
    })

    it('renames the item to the first name, adds the second, and shares every month\'s amount between them', async () => {
        await splitBudgetItem({ item: food, into: ['Groceries', 'Eating out'], share: 0.6, existing: [food] })
        expect(ops('budget_items', 'update').map(o => o.args[0])).toEqual([{ name: 'Groceries' }])
        expect(ops('budget_items', 'insert').map(o => o.args[0])).toEqual([{ user_id: 'user-1', name: 'Eating out', type: 'expense' }])
        const rows = ops('budget_amounts', 'upsert')[0].args[0]
        expect(rows).toEqual([
            { user_id: 'user-1', budget_item_id: 'food-id', year: 2026, month: 1, amount: 240 },
            { user_id: 'user-1', budget_item_id: 'food-id', year: 2026, month: 2, amount: 241 },
            { user_id: 'user-1', budget_item_id: 'food-id', year: 2025, month: 12, amount: 180 },
            { user_id: 'user-1', budget_item_id: 'new-1', year: 2026, month: 1, amount: 160 },
            { user_id: 'user-1', budget_item_id: 'new-1', year: 2026, month: 2, amount: 160 },
            { user_id: 'user-1', budget_item_id: 'new-1', year: 2025, month: 12, amount: 120 },
        ])
    })

    it('adds to an item you already have with the second name instead of making another', async () => {
        const out = { id: 'out-id', name: 'eating out', type: 'expense' }
        await splitBudgetItem({ item: food, into: ['Groceries', 'Eating Out'], share: 0.5, existing: [food, out] })
        expect(ops('budget_items', 'insert')).toEqual([])
        const rows = ops('budget_amounts', 'upsert')[0].args[0]
        expect(rows.filter((r: any) => r.budget_item_id === 'out-id').map((r: any) => r.amount)).toEqual([200, 200, 150])
    })

    it('refuses a first name that another item already has', async () => {
        await expect(splitBudgetItem({ item: food, into: ['Eating out', 'Groceries'], share: 0.5, existing: [food, { id: 'x', name: 'Eating Out', type: 'expense' }] }))
            .rejects.toThrow('You already have Eating Out')
    })
})
