import { useState, useEffect } from 'react'
import { supabase } from '../../../shared/supabase'
import { BudgetItem, BudgetAmount, BudgetType } from './types'
import { useToastContext } from '../../../shared/ui/ToastContext'
import { cellAmount, rowTotal, monthTotal, sectionTotal, netByMonth, netTotal, parseBudgetInput, varies, sortItems } from './calculations'
import { setEveryMonth, deleteBudgetItem, restoreBudgetItem, DeletedBudgetItem, copyYear, clearYear, saveOrder } from './data'
import { formatMoney } from '../../../shared/money/format'

export function useBudgetLogic() {
    const { showToast } = useToastContext()
    const [year, setYear] = useState(new Date().getFullYear())
    const [items, setItems] = useState<BudgetItem[]>([])
    const [amounts, setAmounts] = useState<BudgetAmount[]>([])
    const [loading, setLoading] = useState(true)

    const [newItemName, setNewItemName] = useState('')
    const [newItemType, setNewItemType] = useState<BudgetType>('income')
    const [addingType, setAddingType] = useState<BudgetType | null>(null)

    const [editingCell, setEditingCell] = useState<{ itemId: string; month: number } | null>(null)
    const [editingValue, setEditingValue] = useState('')

    useEffect(() => { fetchData() }, [year])

    async function fetchData() {
        setLoading(true)
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const { data: itemsData } = await supabase
            .from('budget_items')
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at')

        const { data: amountsData } = await supabase
            .from('budget_amounts')
            .select('*')
            .eq('user_id', session.user.id)
            .eq('year', year)

        if (itemsData) setItems(sortItems(itemsData))
        if (amountsData) setAmounts(amountsData)
        setLoading(false)
    }

    const getAmount = (itemId: string, month: number) => cellAmount(amounts, itemId, month)
    const getRowTotal = (itemId: string) => rowTotal(amounts, itemId)
    const getMonthTotal = (type: BudgetType, month: number) => monthTotal(items, amounts, type, month)
    const getSectionTotal = (type: BudgetType) => sectionTotal(items, amounts, type)
    const getNetByMonth = (month: number) => netByMonth(items, amounts, month)
    const getNetTotal = () => netTotal(items, amounts)

    async function handleCellSave(itemId: string, month: number, value: string, fillRight: boolean) {
        const amount = parseBudgetInput(value) // "1,200" and "$1,200" both save 1200
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        if (fillRight) {
            for (let m = month; m <= 12; m++) {
                const { error } = await supabase.from('budget_amounts').upsert({
                    user_id: session.user.id,
                    budget_item_id: itemId,
                    month: m,
                    year,
                    amount,
                }, { onConflict: 'budget_item_id,month,year' })

                if (error) { fetchData(); setEditingCell(null); showToast('Failed to save', 'error'); return }

                setAmounts(prev => {
                    const filtered = prev.filter(a => !(a.budget_item_id === itemId && a.month === m && a.year === year))
                    return [...filtered, { id: '', user_id: session.user.id, budget_item_id: itemId, month: m, year, amount }]
                })
            }
            showToast('Saved for the rest of the year')
        } else {
            const { error } = await supabase.from('budget_amounts').upsert({
                user_id: session.user.id,
                budget_item_id: itemId,
                month,
                year,
                amount,
            }, { onConflict: 'budget_item_id,month,year' })

            if (error) { fetchData(); setEditingCell(null); showToast('Failed to save', 'error'); return }

            setAmounts(prev => {
                const filtered = prev.filter(a => !(a.budget_item_id === itemId && a.month === month && a.year === year))
                return [...filtered, { id: '', user_id: session.user.id, budget_item_id: itemId, month, year, amount }]
            })
            showToast('Saved!')
        }

        setEditingCell(null)
    }

    /** One amount for every month of the year. */
    async function handleSetEveryMonth(itemId: string, value: string) {
        const amount = parseBudgetInput(value)
        try {
            await setEveryMonth(itemId, year, amount)
        } catch {
            fetchData()
            showToast('Failed to save', 'error')
            return
        }
        setAmounts(prev => [
            ...prev.filter(a => !(a.budget_item_id === itemId && a.year === year)),
            ...Array.from({ length: 12 }, (_, i) => ({ id: '', user_id: '', budget_item_id: itemId, month: i + 1, year, amount })),
        ])
        const name = items.find(i => i.id === itemId)?.name ?? 'Saved'
        showToast(`${name}: ${formatMoney(amount, { cents: amount % 1 !== 0 })} every month`)
    }

    /** Fills an empty year with last year's plan, with Undo. */
    async function handleCopyLastYear() {
        const from = year - 1, to = year
        const ids = items.map(i => i.id)
        let rows: Awaited<ReturnType<typeof copyYear>>
        try { rows = await copyYear(from, to, ids) } catch (e: any) { showToast(e?.message ?? `Couldn't copy ${from}`, 'error'); return }
        if (!rows.length) { showToast(`Nothing was planned in ${from} to copy`, 'info'); return }
        setAmounts(prev => [...prev.filter(a => a.year !== to), ...rows.map(r => ({ id: '', ...r }))])
        showToast(`Copied ${from}'s budget into ${to}`, 'success', {
            label: 'Undo',
            onPress: async () => {
                try { await clearYear(to, ids); showToast(`${to} is empty again`) }
                catch (e: any) { showToast(e?.message ?? "Couldn't undo the copy", 'error') }
                await fetchData()
            },
        })
    }

    /** Moves an item one place up (-1) or down (1) within its section, and saves the order. */
    async function handleMoveItem(id: string, step: -1 | 1) {
        const item = items.find(i => i.id === id)
        if (!item) return
        const section = items.filter(i => i.type === item.type)
        const at = section.findIndex(i => i.id === id)
        const swap = at + step
        if (swap < 0 || swap >= section.length) return
        const reordered = [...section]
        ;[reordered[at], reordered[swap]] = [reordered[swap], reordered[at]]
        const order = reordered.map((i, position) => ({ id: i.id, position }))
        setItems(prev => sortItems(prev.map(i => ({ ...i, position: order.find(o => o.id === i.id)?.position ?? i.position }))))
        try { await saveOrder(order) } catch (e: any) { showToast(e?.message ?? "Couldn't save the order", 'error'); fetchData() }
    }

    async function handleAddItem() {
        if (!newItemName.trim()) return
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const { data, error } = await supabase.from('budget_items').insert({
            user_id: session.user.id,
            name: newItemName.trim(),
            type: newItemType,
        }).select().single()

        if (!error && data) {
            setItems(prev => [...prev, data])
            setNewItemName('')
            setAddingType(null)
            showToast('Budget item added!')
        } else {
            fetchData()
            showToast('Failed to add item', 'error')
        }
    }

    /** Deletes an item (after you've confirmed), with Undo in the message. */
    async function handleDeleteItem(id: string) {
        const item = items.find(i => i.id === id)
        if (!item) return
        let deleted: DeletedBudgetItem
        try {
            deleted = await deleteBudgetItem(item)
        } catch {
            fetchData()
            showToast('Failed to delete', 'error')
            return
        }
        setItems(prev => prev.filter(i => i.id !== id))
        setAmounts(prev => prev.filter(a => a.budget_item_id !== id))
        showToast(`${item.name} deleted`, 'success', {
            label: 'Undo',
            onPress: async () => {
                try {
                    await restoreBudgetItem(deleted)
                    showToast(`${item.name} is back`)
                } catch (e: any) {
                    showToast(e?.message ?? `Couldn't bring back ${item.name}`, 'error')
                }
                await fetchData()
            },
        })
    }

    return {
        year, setYear,
        items, amounts, loading,
        newItemName, setNewItemName,
        newItemType, setNewItemType,
        addingType, setAddingType,
        editingCell, setEditingCell,
        editingValue, setEditingValue,
        getAmount, getRowTotal, getMonthTotal, getSectionTotal,
        handleCellSave, handleAddItem, handleDeleteItem, handleSetEveryMonth, handleCopyLastYear, handleMoveItem,
        yearIsEmpty: items.length > 0 && !amounts.some(a => a.year === year && Number(a.amount) !== 0),
        varies: (itemId: string) => varies(amounts, itemId),
        getNetByMonth, getNetTotal,
        reload: fetchData,
    }
}