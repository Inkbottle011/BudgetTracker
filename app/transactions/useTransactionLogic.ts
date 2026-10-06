import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTransactionStore } from '../../store/useTransactionStore'
import { EditingTransaction } from './types'
import { useToastContext } from '../../context/ToastContext'
import { parseAmount, parseDate, todayString } from '../../lib/entry'
import { withRunningBalance, filterTransactions, sortTransactions, toCSV } from './listLogic'
import { totalShares } from '../../lib/splits'

export function useTransactionLogic() {
    const { transactions, setTransactions } = useTransactionStore()
    const { showToast } = useToastContext()
    
    // Add form state
    const [type, setType] = useState('Expense')
    const [category, setCategory] = useState('')
    const [amount, setAmount] = useState('')
    const [details, setDetails] = useState('')
    const [date, setDate] = useState(todayString()) // local date, not UTC (UTC is tomorrow after 8pm in New York)
    const [name, setName] = useState('')
    const [errors, setErrors] = useState<{ amount?: string; date?: string; split?: string }>({})
    // People who owe you part of this expense (empty rows are ignored)
    const [splitOpen, setSplitOpen] = useState(false)
    const [splits, setSplits] = useState<{ person: string; amount: string }[]>([])
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
    const [budgetCategories, setBudgetCategories] = useState<Record<string, string[]>>({
        Income: [], Expense: [], Savings: [], Investment: []
    })
    const [showImport, setShowImport] = useState(false)
    
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
    
    // Split rows that have something typed in them
    const filledSplits = () => splits.filter(r => r.person.trim() || r.amount.trim())

    function validate() {
        const e: { amount?: string; date?: string; split?: string } = {}
        if (!date) e.date = 'Required'
        else if (!parseDate(date)) e.date = 'Use a date like 2026-10-05 or 10/5/2026'
        const amt = parseAmount(amount)
        if (amt === null || amt === 0) e.amount = 'Enter an amount, like 12.50'
        if (type === 'Expense' && filledSplits().length) {
            const rows = filledSplits()
            if (rows.some(r => !r.person.trim())) e.split = 'Add a name for each person'
            else if (rows.some(r => !parseAmount(r.amount))) e.split = 'Enter how much each person owes'
            else if (amt && totalShares(rows) > Math.abs(amt) + 0.005) e.split = "Others can't owe more than the total"
        }
        setErrors(e)
        return !e.date && !e.amount && !e.split
    }

    /** Share the amount equally between you and everyone listed; you keep any leftover cent. */
    function splitEvenly() {
        const total = Math.abs(parseAmount(amount) ?? 0)
        const people = splits.length
        if (!total || !people) return
        const each = Math.floor((total / (people + 1)) * 100) / 100
        setSplits(rows => rows.map(r => ({ ...r, amount: each.toFixed(2) })))
        setErrors(e => ({ ...e, split: undefined }))
    }

    function openSplit() {
        setSplitOpen(true)
        if (splits.length === 0) setSplits([{ person: '', amount: '' }])
    }

    function closeSplit() {
        setSplitOpen(false)
        setSplits([])
        setErrors(e => ({ ...e, split: undefined }))
    }
    
    // Pick a past transaction from the name suggestions: fill in its details
    function applySuggestion(t: { name?: string; amount: number; type: string; category_label?: string }) {
        setName(t.name || '')
        setAmount(String(t.amount))
        setType(t.type.charAt(0).toUpperCase() + t.type.slice(1))
        setCategory(t.category_label || '')
        setErrors({})
    }
    
    async function handleAdd() {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        if (!validate()) return
        setSaving(true)
        setErrors({})
        const shares = type === 'Expense' ? filledSplits() : []
        const { data: created, error } = await supabase.from('transactions').insert({
            user_id: session.user.id,
            type: type.toLowerCase(),
            category_id: null,
            amount: Math.abs(parseAmount(amount)!),
            name: name.trim(),
            note: details.trim(),
            category_label: category,
            date: parseDate(date)!,
        }).select('id').single()
        if (!error) {
            let message = 'Transaction added!'
            if (shares.length && created?.id) {
                const { error: shareError } = await supabase.from('split_shares').insert(
                    shares.map(r => ({ expense_id: created.id, person: r.person.trim(), amount: Math.abs(parseAmount(r.amount)!) })),
                )
                message = shareError
                    ? "Transaction added, but who owes you couldn't be saved"
                    : `Transaction added! $${totalShares(shares).toFixed(2)} is owed to you.`
            }
            // Keep the type and date for the next entry; clear the rest
            setAmount(''); setDetails(''); setCategory(''); setName(''); setDate(parseDate(date)!)
            setSplits([]); setSplitOpen(false)
            setSuccess(true)
            setTimeout(() => setSuccess(false), 2000)
            fetchTransactions()
            if (message.includes("couldn't")) showToast(message, 'error')
            else showToast(message)
        } else {
            showToast('Failed to add transaction', 'error')
        }
        setSaving(false)
    }
    
    async function handleSaveEdit() {
        if (!editingTransaction) return
        const editAmount = parseAmount(editingTransaction.amount)
        const editDate = parseDate(editingTransaction.date)
        if (editAmount === null || editAmount === 0) { showToast('Enter an amount, like 12.50', 'error'); return }
        if (!editDate) { showToast('Use a date like 2026-10-05 or 10/5/2026', 'error'); return }
        setSaving(true)
        const { error } = await supabase
            .from('transactions')
            .update({
                type: editingTransaction.type.toLowerCase(),
                category_label: editingTransaction.category,
                name: editingTransaction.name,
                amount: Math.abs(editAmount),
                note: editingTransaction.details,
                date: editDate,
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
    
    function exportToCSV() {
        const blob = new Blob([toCSV(totalRows)], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `transactions_${todayString()}.csv`
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
            grouped.Reimbursement = grouped.Expense // paybacks go against spending categories
            grouped.Withdrawal = grouped.Savings    // withdrawals come out of savings categories
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
            date: todayString(),
        })
        if (!error) {
            fetchTransactions()
            showToast('Transaction duplicated!')
        } else {
            showToast('Failed to duplicate transaction', 'error')
        }
    }
    
    const totalRows = sortTransactions(
        filterTransactions(withRunningBalance(transactions), { search, type: filterType, from: filterFrom, to: filterTo }),
        sortCol, sortDir,
    )
    
    const rows = totalRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
    const totalPages = Math.ceil(totalRows.length / PAGE_SIZE)
    
    return {
        type, setType, category, setCategory, amount, setAmount,
        details, setDetails, date, setDate, name, setName,
        errors, setErrors, saving, success,
        handleAdd, applySuggestion, transactions,
        splitOpen, openSplit, closeSplit, splits, setSplits, splitEvenly,
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
        budgetCategories,
        showImport, setShowImport,fetchTransactions,
    }
}