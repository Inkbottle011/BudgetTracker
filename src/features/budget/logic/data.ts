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

/**
 * Splits one budget item into two: it's renamed to the first name (keeping its history), and the second
 * is added (or, if you already have it, added to). Every planned month, in every year, is shared
 * between them: `share` of it to the first (in whole dollars), the rest to the second.
 */
export async function splitBudgetItem({ item, into, share, existing }: {
    item: { id: string; name: string; type: string }
    into: [string, string]
    share: number
    existing: { id: string; name: string; type: string }[]
}): Promise<void> {
    const user = await userId()
    const [first, second] = into.map(n => n.trim()) as [string, string]
    const same = (a: string, b: string) => a.trim().toLowerCase() === b.toLowerCase()
    const clash = existing.find(e => e.id !== item.id && e.type === item.type && same(e.name, first))
    if (clash) throw new Error(`You already have ${clash.name}. Pick another name for the first part.`)
    const fail = (e: { message: string } | null | undefined) => { if (e) throw new Error(`Couldn't split ${item.name}: ${e.message}`) }

    // The second part: one you already have, or a new item
    let secondId = existing.find(e => e.id !== item.id && e.type === item.type && same(e.name, second))?.id
    const { data: rows, error: loadError } = await supabase.from('budget_amounts').select('*')
        .in('budget_item_id', secondId ? [item.id, secondId] : [item.id])
    fail(loadError)
    if (!secondId) {
        const { data, error } = await supabase.from('budget_items').insert({ user_id: user, name: second, type: item.type }).select().single()
        fail(error ?? (data ? null : { message: 'unknown error' }))
        secondId = (data as any).id as string
    }
    if (!same(item.name, first)) {
        const { error } = await supabase.from('budget_items').update({ name: first }).eq('id', item.id)
        fail(error)
    }

    const all = (rows ?? []) as { budget_item_id: string; year: number; month: number; amount: number | string }[]
    const had = (year: number, month: number) => Number(all.find(r => r.budget_item_id === secondId && r.year === year && r.month === month)?.amount ?? 0)
    const mine = all.filter(r => r.budget_item_id === item.id)
    const firstPart = (amount: number) => Math.round(amount * share)   // budgets are in whole dollars
    const upserts = [
        ...mine.map(r => ({ user_id: user, budget_item_id: item.id, year: r.year, month: r.month, amount: firstPart(Number(r.amount)) })),
        ...mine.map(r => {
            const amount = Number(r.amount)
            return { user_id: user, budget_item_id: secondId!, year: r.year, month: r.month, amount: Math.round((amount - firstPart(amount) + had(r.year, r.month)) * 100) / 100 }
        }),
    ]
    if (upserts.length) {
        const { error } = await supabase.from('budget_amounts').upsert(upserts, { onConflict: 'budget_item_id,month,year' })
        fail(error)
    }
}

/** Everything needed to put a deleted budget item back exactly as it was. */
export interface DeletedBudgetItem { item: Record<string, any>; amounts: Record<string, any>[] }

/** Deletes a budget item and its planned amounts, and returns them so it can be undone. */
export async function deleteBudgetItem(item: { id: string } & Record<string, any>): Promise<DeletedBudgetItem> {
    const { data: rows, error: loadError } = await supabase.from('budget_amounts').select('*').eq('budget_item_id', item.id)
    if (loadError) throw new Error(`Couldn't delete ${item.name}: ${loadError.message}`)
    const { error } = await supabase.from('budget_items').delete().eq('id', item.id)
    if (error) throw new Error(`Couldn't delete ${item.name}: ${error.message}`)
    return { item, amounts: ((rows ?? []) as any[]).filter(r => r.budget_item_id === item.id) }
}

/** Puts a deleted budget item back: the same item (same id, so transactions still match it) and every amount. */
export async function restoreBudgetItem({ item, amounts }: DeletedBudgetItem): Promise<void> {
    const { error } = await supabase.from('budget_items').insert(item)
    if (error) throw new Error(`Couldn't bring back ${item.name}: ${error.message}`)
    if (amounts.length) {
        const { error: amountsError } = await supabase.from('budget_amounts').upsert(amounts, { onConflict: 'budget_item_id,month,year' })
        if (amountsError) throw new Error(`${item.name} is back, but its amounts couldn't be restored: ${amountsError.message}`)
    }
}
