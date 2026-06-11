import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTransactionStore } from '../../store/useTransactionStore'
import { EditingTransaction } from './types'

export function useTransactionLogic() {
    const { transactions, setTransactions } = useTransactionStore()
    
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
    
    // Search/filter/sort state
    const [search, setSearch] = useState('')
    const [filterType, setFilterType] = useState<string | null>(null)
    const [filterFrom, setFilterFrom] = useState('')
    const [filterTo, setFilterTo] = useState('')
    const [showFilters, setShowFilters] = useState(false)
    const [sortCol, setSortCol] = useState<string>('date')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
    
    useEffect(() => { fetchTransactions() }, [])
    
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
        })
        if (!error) {
            setAmount(''); setDetails(''); setCategory(''); setName('')
            setSuccess(true)
            setTimeout(() => setSuccess(false), 2000)
            fetchTransactions()
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
        })
        .eq('id', editingTransaction.id)
        if (!error) {
            setEditingTransaction(null)
            fetchTransactions()
        }
        setSaving(false)
    }
    
    function handleEditSelect(t: any) {
        if (selectMode) { toggleSelect(t.id); return }
        setEditingTransaction({
            id: t.id,
            type: t.type.charAt(0).toUpperCase() + t.type.slice(1),
            category: t.category_label || '',
            name: t.name || '',
            amount: String(t.amount),
            details: t.note || '',
            date: t.date,
        })
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
        if (!error) { await fetchTransactions(); exitSelectMode() }
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
    
    const rows = runningBalance()
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
    
    return {
        // form
        type, setType, category, setCategory, amount, setAmount,
        details, setDetails, date, setDate, name, setName,
        errors, setErrors, saving, success,
        handleAdd,
        // edit
        editingTransaction, setEditingTransaction,
        handleSaveEdit, handleEditSelect,
        // select/delete
        selectMode, setSelectMode, selected,
        deleting, confirmDelete, setConfirmDelete,
        toggleSelect, exitSelectMode, handleDelete,
        // search/filter/sort
        search, setSearch,
        filterType, setFilterType,
        filterFrom, setFilterFrom,
        filterTo, setFilterTo,
        showFilters, setShowFilters,
        sortCol, sortDir, handleSort,
        // data
        rows,
    }
}