import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { BudgetItem, BudgetAmount, BudgetType } from './types'
import { useToastContext } from '../../context/ToastContext'
import { cellAmount, rowTotal, monthTotal, sectionTotal, netByMonth, netTotal, parseBudgetInput } from './calculations'

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

        if (itemsData) setItems(itemsData)
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
            showToast('Filled right!')
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

    async function handleDeleteItem(id: string) {
        const { error } = await supabase.from('budget_items').delete().eq('id', id)
        if (error) { fetchData(); showToast('Failed to delete', 'error'); return }
        setItems(prev => prev.filter(i => i.id !== id))
        setAmounts(prev => prev.filter(a => a.budget_item_id !== id))
        showToast('Budget item deleted')
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
        handleCellSave, handleAddItem, handleDeleteItem,
        getNetByMonth, getNetTotal,
    }
}