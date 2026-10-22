// The budget's own tables (budget_items, budget_amounts). Other features read the budget through these.
import { supabase } from '../../../shared/supabase'
import { fetchAllRows } from '../../../shared/fetchAllRows'

/** Every budget category (income, spending, savings, investment), oldest first. */
export async function loadBudgetItems() {
    const { data } = await supabase.from('budget_items').select('*').order('created_at')
    return data ?? null
}

/** Planned amounts for every month of every year. */
export async function loadBudgetAmounts(): Promise<any[] | null> {
    try {
        return await fetchAllRows(() => supabase.from('budget_amounts').select('*').order('budget_item_id').order('year').order('month'))
    } catch {
        return null
    }
}

/** Just the category names and their types, oldest first: for category pickers. */
export async function loadCategoryNames(): Promise<{ name: string; type: string }[] | null> {
    const { data } = await supabase.from('budget_items').select('name, type').order('created_at')
    return data ?? null
}

async function userId(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Please sign in again')
    return session.user.id
}

async function saveAmounts(rows: { user_id: string; budget_item_id: string; month: number; year: number; amount: number }[]) {
    if (!rows.length) return
    const { error } = await supabase.from('budget_amounts').upsert(rows, { onConflict: 'budget_item_id,month,year' })
    if (error) throw new Error(`Couldn't save your plan: ${error.message}`)
}

/**
 * Puts a plan into the budget: an item with the same name (and kind) is reused, anything new is added,
 * and each gets its monthly amount from `fromMonth` through December. Nothing is deleted.
 */
export async function applyPlan({ year, fromMonth, items, existing }: {
    year: number
    fromMonth: number
    items: { name: string; type: string; monthly: number }[]
    existing: { id: string; name: string; type: string }[]
}): Promise<{ added: number; updated: number }> {
    const user = await userId()
    let added = 0, updated = 0
    const rows: { user_id: string; budget_item_id: string; month: number; year: number; amount: number }[] = []
    for (const item of items) {
        let id = existing.find(e => e.type === item.type && e.name.trim().toLowerCase() === item.name.trim().toLowerCase())?.id
        if (id) updated++
        else {
            const { data, error } = await supabase.from('budget_items').insert({ user_id: user, name: item.name.trim(), type: item.type }).select().single()
            if (error || !data) throw new Error(`Couldn't save your plan: ${error?.message ?? 'unknown error'}`)
            id = (data as any).id as string
            added++
        }
        for (let m = fromMonth; m <= 12; m++) rows.push({ user_id: user, budget_item_id: id, month: m, year, amount: item.monthly })
    }
    await saveAmounts(rows)
    return { added, updated }
}

/** One amount for every month of the year. */
export async function setEveryMonth(itemId: string, year: number, amount: number): Promise<void> {
    const user = await userId()
    await saveAmounts(Array.from({ length: 12 }, (_, i) => ({ user_id: user, budget_item_id: itemId, month: i + 1, year, amount })))
}
