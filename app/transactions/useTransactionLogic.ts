import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTransactionStore } from '../../store/useTransactionStore'
import { EditingTransaction } from './types'
import { useToastContext } from '../../context/ToastContext'

export function useTransactionLogic() {
    const { transactions, setTransactions } = useTransactionStore()
    const { showToast } = useToastContext()
    
    // Add form state
    const [type, setType] = useState('Expense')
    const [category, setCategory] = useState('')
    const [amount, setAmount] = useState('')
    const [details, setDetails] = useState('')
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])
    const [name, setName] = useState('')
    const [errors, setErrors] = useState<{ amount?: string; date?: string }>({})
    const [saving, setSaving] = useState(false)
    const [success, setSuccess] = useState(false)
    
    // Edit state
    const [editingTransaction, setEditingTransaction] = useState<EditingTransaction | null>(null)
    
    // Select/delete state
    const [selectMode, setSelectMode] = useState(false)
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [deleting, setDeleting] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [editMode, setEditMode] = useState(false)
    
    // Search/filter/sort state
    const [search, setSearch] = useState('')
    const [filterType, setFilterType] = useState<string | null>(null)
    const [filterFrom, setFilterFrom] = useState('')
    const [filterTo, setFilterTo] = useState('')
    const [showFilters, setShowFilters] = useState(false)
    const [sortCol, setSortCol] = useState<string>('date')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
    
    const [page, setPage] = useState(0)
    const PAGE_SIZE = 20
    const [duplicateMode, setDuplicateMode] = useState(false)
    const [recurring, setRecurring] = useState('none')
    const [recurringEnd, setRecurringEnd] = useState('')
    const [budgetCategories, setBudgetCategories] = useState<Record<string, string[]>>({
        Income: [], Expense: [], Savings: [], Investment: []
    })
    
    useEffect(() => { setPage(0) }, [search, filterType, filterFrom, filterTo])
    useEffect(() => {
        fetchTransactions()
        fetchBudgetCategories()
    }, [])

    async function fetchTransactions() {
        const { data } = await supabase
            .from('transactions')
            .select('*')
            .order('date', { ascending: false })
        if (data) setTransactions(data)
    }
    
    function validate() {
        const e: { amount?: string; date?: string } = {}
        if (!date) e.date = 'Required'
        if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) e.amount = 'Enter a valid amount'
        setErrors(e)
        return !e.date && !e.amount
    }
    
    async function handleAdd() {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        if (!validate()) return
        setSaving(true)
        setErrors({})
        const { error } = await supabase.from('transactions').insert({
            user_id: session.user.id,
            type: type.toLowerCase(),
            category_id: null,
            amount: parseFloat(amount),
            name,
            note: details,
            category_label: category,
            date,
            recurring: recurring,
            recurring_end: recurringEnd || null,
        })
        if (!error) {
            setAmount(''); setDetails(''); setCategory(''); setName(''); setRecurring('none'); setRecurringEnd('')
            setSuccess(true)
            setTimeout(() => setSuccess(false), 2000)
            fetchTransactions()
            showToast('Transaction added!')
        } else {
            showToast('Failed to add transaction', 'error')
        }
        setSaving(false)
    }
    
    async function handleSaveEdit() {
        if (!editingTransaction) return
        setSaving(true)
        const { error } = await supabase
            .from('transactions')
            .update({
                type: editingTransaction.type.toLowerCase(),
                category_label: editingTransaction.category,
                name: editingTransaction.name,
                amount: parseFloat(editingTransaction.amount),
                note: editingTransaction.details,
                date: editingTransaction.date,
                recurring: editingTransaction.recurring,
                recurring_end: editingTransaction.recurring_end || null,
            })
            .eq('id', editingTransaction.id)
        if (!error) {
            setEditingTransaction(null)
            fetchTransactions()
            showToast('Transaction updated!')
        } else {
            showToast('Failed to update transaction', 'error')
        }
        setSaving(false)
    }
    
    function handleEditSelect(t: any) {
        if (selectMode) { toggleSelect(t.id); return }
        if (duplicateMode) {
            handleDuplicate(t)
            setDuplicateMode(false)
            return
        }
        if (editMode) {
            setEditingTransaction({
                id: t.id,
                type: t.type.charAt(0).toUpperCase() + t.type.slice(1),
                category: t.category_label || '',
                name: t.name || '',
                amount: String(t.amount),
                details: t.note || '',
                date: t.date,
                recurring: t.recurring || 'none',
                recurring_end: t.recurring_end || '',
            })
            setEditMode(false)
            return
        }
    }
    
    function toggleSelect(id: string) {
        setSelected(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }
    
    function exitSelectMode() {
        setSelectMode(false)
        setSelected(new Set())
        setConfirmDelete(false)
    }
    
    async function handleDelete() {
        if (selected.size === 0) return
        setDeleting(true)
        const { error } = await supabase
            .from('transactions')
            .delete()
            .in('id', Array.from(selected))
        if (!error) {
            await fetchTransactions()
            exitSelectMode()
            showToast(`${selected.size} transaction${selected.size > 1 ? 's' : ''} deleted`)
        } else {
            showToast('Failed to delete transactions', 'error')
        }
        setDeleting(false)
    }
    
    function handleSort(col: string) {
        if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
        else { setSortCol(col); setSortDir('asc') }
    }
    
    function runningBalance() {
        const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        let balance = 0
        return sorted.map(t => {
            if (t.type === 'expense') balance -= t.amount
            else balance += t.amount
            return { ...t, balance }
        }).reverse()
    }
    
    function exportToCSV() {
        const headers = ['Date', 'Type', 'Category', 'Name', 'Amount', 'Details', 'Balance']
        const csvRows = [
            headers.join(','),
            ...totalRows.map(t => [
                t.date,
                t.type,
                t.category_label || '',
                t.name || '',
                t.amount,
                t.note || '',
                t.balance,
            ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
        ]
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`
        a.click()
        URL.revokeObjectURL(url)
        showToast('CSV exported!')
    }

    async function fetchBudgetCategories() {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        const { data } = await supabase
            .from('budget_items')
            .select('name, type')
            .eq('user_id', session.user.id)
            .order('created_at')

        if (data && data.length > 0) {
            const grouped: Record<string, string[]> = {
                Income: [], Expense: [], Savings: [], Investment: []
            }
            data.forEach(item => {
                const key = item.type.charAt(0).toUpperCase() + item.type.slice(1)
                if (grouped[key]) grouped[key].push(item.name)
            })
            setBudgetCategories(grouped)
        }
    }
    
    async function handleDuplicate(t: any) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        const { error } = await supabase.from('transactions').insert({
            user_id: session.user.id,
            type: t.type,
            category_id: null,
            amount: t.amount,
            name: t.name,
            note: t.note,
            category_label: t.category_label,
            date: new Date().toISOString().split('T')[0],
        })
        if (!error) {
            fetchTransactions()
            showToast('Transaction duplicated!')
        } else {
            showToast('Failed to duplicate transaction', 'error')
        }
    }
    
    const totalRows = runningBalance()
        .filter(t => {
            if (!search && !filterType && !filterFrom && !filterTo) return true
            const q = search.toLowerCase()
            const matchSearch = !search || (
                t.name?.toLowerCase().includes(q) ||
                t.note?.toLowerCase().includes(q) ||
                t.type?.toLowerCase().includes(q) ||
                t.date?.includes(q) ||
                t.category_label?.toLowerCase().includes(q)
            )
            const matchType = !filterType || t.type === filterType.toLowerCase()
            const matchFrom = !filterFrom || t.date >= filterFrom
            const matchTo = !filterTo || t.date <= filterTo
            return matchSearch && matchType && matchFrom && matchTo
        })
        .sort((a, b) => {
            let valA: any, valB: any
            if (sortCol === 'date') { valA = a.date; valB = b.date }
            else if (sortCol === 'amount') { valA = a.amount; valB = b.amount }
            else if (sortCol === 'type') { valA = a.type; valB = b.type }
            else return 0
            if (valA < valB) return sortDir === 'asc' ? -1 : 1
            if (valA > valB) return sortDir === 'asc' ? 1 : -1
            return 0
        })
    
    const rows = totalRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
    const totalPages = Math.ceil(totalRows.length / PAGE_SIZE)
    
    return {
        type, setType, category, setCategory, amount, setAmount,
        details, setDetails, date, setDate, name, setName,
        errors, setErrors, saving, success,
        handleAdd,
        editingTransaction, setEditingTransaction,
        handleSaveEdit, handleEditSelect,
        editMode, setEditMode,
        selectMode, setSelectMode, selected,
        deleting, confirmDelete, setConfirmDelete,
        toggleSelect, exitSelectMode, handleDelete,
        search, setSearch,
        filterType, setFilterType,
        filterFrom, setFilterFrom,
        filterTo, setFilterTo,
        showFilters, setShowFilters,
        sortCol, sortDir, handleSort,
        rows,
        page, setPage, totalPages,
        exportToCSV, handleDuplicate, duplicateMode, setDuplicateMode,
        recurring, setRecurring, recurringEnd, setRecurringEnd, budgetCategories,
    }
}