// The budget's own tables (budget_items, budget_amounts). Other features read the budget through these.
import { supabase } from '../../../shared/supabase'

/** Every budget category (income, spending, savings, investment), oldest first. */
export async function loadBudgetItems() {
    const { data } = await supabase.from('budget_items').select('*').order('created_at')
    return data ?? null
}

/** Planned amounts for every month of every year. */
export async function loadBudgetAmounts() {
    const { data } = await supabase.from('budget_amounts').select('*')
    return data ?? null
}

/** Just the category names and their types, oldest first: for category pickers. */
export async function loadCategoryNames(): Promise<{ name: string; type: string }[] | null> {
    const { data } = await supabase.from('budget_items').select('name, type').order('created_at')
    return data ?? null
}
