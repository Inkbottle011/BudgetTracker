import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { supabase } from '../lib/supabase'
import { useTransactionStore } from '../store/useTransactionStore'

const TYPES = ['Income', 'Expense', 'Savings', 'Investment']

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
    Income:     { bg: '#2980b9', text: '#fff' },
    Expense:    { bg: '#e74c3c', text: '#fff' },
    Savings:    { bg: '#27ae60', text: '#fff' },
    Investment: { bg: '#8e44ad', text: '#fff' },
}

const DEFAULT_CATEGORIES: Record<string, string[]> = {
    Income:     ['Salary', 'Freelance', 'Bonus', 'Other'],
    Expense:    ['Food', 'Rent', 'Utilities', 'Transport', 'Entertainment', 'Other'],
    Savings:    ['Emergency Fund', 'Roth IRA', 'General Savings', 'Other'],
    Investment: ['Stocks', 'Crypto', 'Real Estate', 'ETF', 'Other'],
}

export default function TransactionsScreen() {
    const { transactions, setTransactions } = useTransactionStore()
    const [type, setType] = useState('Expense')
    const [category, setCategory] = useState('')
    const [amount, setAmount] = useState('')
    const [details, setDetails] = useState('')
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])
    const [errors, setErrors] = useState<{ amount?: string; date?: string }>({})
    const [saving, setSaving] = useState(false)
    const [success, setSuccess] = useState(false)
    const [name, setName] = useState('')
    const [selectMode, setSelectMode] = useState(false)
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [deleting, setDeleting] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [search, setSearch] = useState('')
    const [filterType, setFilterType] = useState<string | null>(null)
    const [filterFrom, setFilterFrom] = useState('')
    const [filterTo, setFilterTo] = useState('')
    const [showFilters, setShowFilters] = useState(false)
    const [sortCol, setSortCol] = useState<string>('date')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
    
    useEffect(() => {
        fetchTransactions()
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
            name: name,
            note: details,
            category_label: category,
            date,
        })
        
        if (!error) {
            setAmount('')
            setDetails('')
            setCategory('')
            setName('')
            setSuccess(true)
            setTimeout(() => setSuccess(false), 2000)
            fetchTransactions()
        }
        setSaving(false)
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
        const ids = Array.from(selected)
        const { error } = await supabase
        .from('transactions')
        .delete()
        .in('id', ids)
        if (!error) {
            await fetchTransactions()
            exitSelectMode()
        }
        setDeleting(false)
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
    
    function handleSort(col: string) {
        if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
            else { setSortCol(col); setSortDir('asc') }
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
    
    return (
        <View style={styles.container}>
        
        {/* LEFT — Transaction List */}
        <View style={styles.left}>
        <View style={styles.listHeader}>
        <Text style={styles.sectionTitle}>Transactions</Text>
        <View style={styles.headerActions}>
        {selectMode ? (
            <>
            <Text style={styles.selectedCount}>{selected.size} selected</Text>
            {selected.size > 0 && !confirmDelete && (
                <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => setConfirmDelete(true)}
                >
                <Text style={styles.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
            )}
            {confirmDelete && (
                <>
                <Text style={styles.confirmText}>Are you sure?</Text>
                <TouchableOpacity
                style={styles.deleteBtn}
                onPress={handleDelete}
                disabled={deleting}
                >
                <Text style={styles.deleteBtnText}>{deleting ? 'Deleting...' : 'Confirm'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setConfirmDelete(false)}
                >
                <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                </>
            )}
            <TouchableOpacity style={styles.cancelBtn} onPress={exitSelectMode}>
            <Text style={styles.cancelBtnText}>Exit</Text>
            </TouchableOpacity>
            </>
        ) : (
            <TouchableOpacity
            style={styles.selectBtn}
            onPress={() => setSelectMode(true)}
            >
            <Text style={styles.selectBtnText}>Select</Text>
            </TouchableOpacity>
        )}
        
        <TouchableOpacity
        style={styles.selectBtn}
        onPress={() => setShowFilters(!showFilters)}
        >
        <Text style={styles.selectBtnText}>{showFilters ? 'Hide Filters' : 'Filter'}</Text>
        </TouchableOpacity>
        </View>
        </View>
        
        <TextInput
        style={styles.searchBar}
        placeholder="Search by name, category, or details..."
        value={search}
        onChangeText={setSearch}
        placeholderTextColor="#aaa"
        />
        {showFilters && (
            <View style={styles.filterPanel}>
            <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Type:</Text>
            {['Income', 'Expense', 'Savings', 'Investment'].map(t => (
                <TouchableOpacity
                key={t}
                style={[styles.filterChip, filterType === t && { backgroundColor: TYPE_COLORS[t].bg }]}
                onPress={() => setFilterType(filterType === t ? null : t)}
                >
                <Text style={[styles.filterChipText, filterType === t && { color: '#fff' }]}>{t}</Text>
                </TouchableOpacity>
            ))}
            </View>
            <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>From:</Text>
            <TextInput
            style={styles.filterInput}
            placeholder="YYYY-MM-DD"
            value={filterFrom}
            onChangeText={setFilterFrom}
            placeholderTextColor="#aaa"
            />
            <Text style={styles.filterLabel}>To:</Text>
            <TextInput
            style={styles.filterInput}
            placeholder="YYYY-MM-DD"
            value={filterTo}
            onChangeText={setFilterTo}
            placeholderTextColor="#aaa"
            />
            {(filterType || filterFrom || filterTo) && (
                <TouchableOpacity
                style={styles.clearBtn}
                onPress={() => { setFilterType(null); setFilterFrom(''); setFilterTo('') }}
                >
                <Text style={styles.clearBtnText}>Clear</Text>
                </TouchableOpacity>
            )}
            </View>
            </View>
        )}
        <View style={styles.tableHeader}>
        {selectMode && <View style={styles.colCheck} />}
        <TouchableOpacity style={[styles.col, styles.colDate]} onPress={() => handleSort('date')}>
        <Text style={styles.headerText}>Date {sortCol === 'date' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.col, styles.colType]} onPress={() => handleSort('type')}>
        <Text style={styles.headerText}>Type {sortCol === 'type' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</Text>
        </TouchableOpacity>
        <Text style={[styles.col, styles.colCat, styles.headerText]}>Category</Text>
        <Text style={[styles.col, styles.colName, styles.headerText]}>Name</Text>
        <TouchableOpacity style={[styles.col, styles.colAmt]} onPress={() => handleSort('amount')}>
        <Text style={styles.headerText}>Amount {sortCol === 'amount' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</Text>
        </TouchableOpacity>
        <Text style={[styles.col, styles.colDet, styles.headerText]}>Details</Text>
        <Text style={[styles.col, styles.colBal, styles.headerText]}>Balance</Text>
        <Text style={[styles.col, styles.colCat, styles.headerText]}>Category</Text>
        <Text style={[styles.col, styles.colName, styles.headerText]}>Name</Text>
        <Text style={[styles.col, styles.colDet, styles.headerText]}>Details</Text>
        <Text style={[styles.col, styles.colBal, styles.headerText]}>Balance</Text>
        </View>
        
        <ScrollView>
        {rows.length === 0 ? (
            <Text style={styles.empty}>No transactions yet. Add one on the right.</Text>
        ) : (
            rows.map((t, i) => {
                const isSelected = selected.has(t.id)
                return (
                    <TouchableOpacity
                    key={t.id}
                    style={[
                        styles.tableRow,
                        i % 2 === 0 ? styles.rowEven : styles.rowOdd,
                        isSelected && styles.rowSelected,
                    ]}
                    onPress={() => selectMode && toggleSelect(t.id)}
                    activeOpacity={selectMode ? 0.6 : 1}
                    >
                    {selectMode && (
                        <View style={styles.colCheck}>
                        <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                        {isSelected && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                        </View>
                    )}
                    <Text style={[styles.col, styles.colDate, styles.cellText]}>{t.date}</Text>
                    <View style={[styles.col, styles.colType]}>
                    <View style={[styles.typeBadge, { backgroundColor: TYPE_COLORS[t.type.charAt(0).toUpperCase() + t.type.slice(1)]?.bg || '#888' }]}>
                    <Text style={styles.typeBadgeText}>{t.type.charAt(0).toUpperCase() + t.type.slice(1)}</Text>
                    </View>
                    </View>
                    <Text style={[styles.col, styles.colCat, styles.cellText]}>{t.category_label || '—'}</Text>
                    <Text style={[styles.col, styles.colName, styles.cellText]}>{t.name || '—'}</Text>
                    <Text style={[styles.col, styles.colAmt, styles.cellText, { color: t.type === 'expense' ? '#e74c3c' : '#27ae60' }]}>
                    {t.type === 'expense' ? '-' : '+'}${Number(t.amount).toFixed(2)}
                    </Text>
                    <Text style={[styles.col, styles.colDet, styles.cellText]}>{t.note || '—'}</Text>
                    <Text style={[styles.col, styles.colBal, styles.cellText]}>${Number(t.balance).toFixed(2)}</Text>
                    </TouchableOpacity>
                )
            })
        )}
        </ScrollView>
        </View>
        
        {/* RIGHT — Add Transaction */}
        <View style={styles.right}>
        <Text style={styles.sectionTitle}>Add Transaction</Text>
        
        {success && (
            <View style={styles.successBanner}>
            <Text style={styles.successText}>Transaction added!</Text>
            </View>
        )}
        
        <Text style={styles.label}>Type</Text>
        <View style={styles.typeRow}>
        {TYPES.map(t => (
            <TouchableOpacity
            key={t}
            style={[styles.typeBtn, type === t && { backgroundColor: TYPE_COLORS[t].bg }]}
            onPress={() => { setType(t); setCategory('') }}
            >
            <Text style={[styles.typeBtnText, type === t && { color: '#fff' }]}>{t}</Text>
            </TouchableOpacity>
        ))}
        </View>
        
        <Text style={styles.label}>Category</Text>
        <View style={styles.categoryRow}>
        {DEFAULT_CATEGORIES[type].map(c => (
            <TouchableOpacity
            key={c}
            style={[styles.catBtn, category === c && styles.catBtnActive]}
            onPress={() => setCategory(c)}
            >
            <Text style={[styles.catBtnText, category === c && styles.catBtnTextActive]}>{c}</Text>
            </TouchableOpacity>
        ))}
        </View>
        
        <Text style={styles.label}>Name</Text>
        <TextInput
        style={styles.input}
        placeholder="e.g. Grocery run, Netflix, Paycheck..."
        value={name}
        onChangeText={setName}
        placeholderTextColor="#aaa"
        />
        
        <Text style={styles.label}>Amount</Text>
        <TextInput
        style={[styles.input, errors.amount ? styles.inputError : null]}
        placeholder="0.00"
        value={amount}
        onChangeText={t => { setAmount(t); setErrors(e => ({ ...e, amount: undefined })) }}
        keyboardType="decimal-pad"
        placeholderTextColor="#aaa"
        />
        {errors.amount && <Text style={styles.errorText}>{errors.amount}</Text>}
        
        <Text style={styles.label}>Date</Text>
        <TextInput
        style={[styles.input, errors.date ? styles.inputError : null]}
        placeholder="YYYY-MM-DD"
        value={date}
        onChangeText={t => { setDate(t); setErrors(e => ({ ...e, date: undefined })) }}
        placeholderTextColor="#aaa"
        />
        {errors.date && <Text style={styles.errorText}>{errors.date}</Text>}
        
        <Text style={styles.label}>Details (optional)</Text>
        <TextInput
        style={styles.input}
        placeholder="Add a note..."
        value={details}
        onChangeText={setDetails}
        placeholderTextColor="#aaa"
        />
        
        <TouchableOpacity
        style={[styles.addBtn, { backgroundColor: TYPE_COLORS[type].bg }, saving && { opacity: 0.6 }]}
        onPress={handleAdd}
        disabled={saving}
        >
        <Text style={styles.addBtnText}>{saving ? 'Saving...' : 'Add Transaction'}</Text>
        </TouchableOpacity>
        </View>
        
        </View>
    )
}

const styles = StyleSheet.create({
    
    container: { flex: 1, flexDirection: 'row', backgroundColor: '#f5f6fa' },
    left: { flex: 3, borderRightWidth: 1, borderColor: '#e0e0e0', padding: 16 },
    right: { flex: 2, padding: 16, backgroundColor: '#fff' },
    listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: '#2c3e50' },
    selectBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#2980b9' },
    selectBtnText: { fontSize: 13, color: '#2980b9', fontWeight: '600' },
    selectedCount: { fontSize: 13, color: '#555', fontWeight: '500' },
    deleteBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: '#e74c3c' },
    deleteBtnText: { fontSize: 13, color: '#fff', fontWeight: '600' },
    cancelBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#aaa' },
    cancelBtnText: { fontSize: 13, color: '#555', fontWeight: '600' },
    confirmText: { fontSize: 13, color: '#e74c3c', fontWeight: '500' },
    tableHeader: { flexDirection: 'row', backgroundColor: '#2980b9', padding: 8, borderRadius: 6, marginBottom: 4 },
    headerText: { color: '#fff', fontWeight: '600', fontSize: 12 },
    tableRow: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 4, alignItems: 'center' },
    rowEven: { backgroundColor: '#fff' },
    rowOdd: { backgroundColor: '#f0f4f8' },
    rowSelected: { backgroundColor: '#fdecea' },
    colCheck: { width: 32, alignItems: 'center' },
    checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: '#aaa', alignItems: 'center', justifyContent: 'center' },
    checkboxChecked: { backgroundColor: '#e74c3c', borderColor: '#e74c3c' },
    checkmark: { color: '#fff', fontSize: 11, fontWeight: '700' },
    col: { paddingHorizontal: 4 },
    colDate: { width: 90 },
    colType: { width: 90 },
    colCat: { width: 100 },
    colName: { width: 120 },
    colAmt: { width: 80 },
    colDet: { width: 100 },
    colBal: { width: 80 },
    cellText: { fontSize: 12, color: '#2c3e50' },
    typeBadge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
    typeBadgeText: { fontSize: 11, color: '#fff', fontWeight: '600' },
    empty: { textAlign: 'center', color: '#aaa', marginTop: 40, fontSize: 13 },
    label: { fontSize: 12, fontWeight: '600', color: '#555', marginBottom: 6, marginTop: 10 },
    typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
    typeBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#f8f9fa' },
    typeBtnText: { fontSize: 12, color: '#555', fontWeight: '500' },
    categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
    catBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#f8f9fa' },
    catBtnActive: { backgroundColor: '#2c3e50', borderColor: '#2c3e50' },
    catBtnText: { fontSize: 11, color: '#555' },
    catBtnTextActive: { color: '#fff' },
    input: { backgroundColor: '#f8f9fa', borderRadius: 8, padding: 10, fontSize: 13, borderWidth: 1, borderColor: '#e8e8e8', color: '#1a1a1a', marginBottom: 2 },
    inputError: { borderColor: '#e74c3c' },
    errorText: { color: '#e74c3c', fontSize: 11, marginBottom: 6 },
    addBtn: { borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 16 },
    addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    successBanner: { backgroundColor: '#eafaf1', borderRadius: 8, padding: 10, marginBottom: 10 },
    successText: { color: '#27ae60', fontSize: 13, textAlign: 'center', fontWeight: '600' },
    searchBar: {
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        padding: 10,
        fontSize: 13,
        borderWidth: 1,
        borderColor: '#e8e8e8',
        color: '#1a1a1a',
        marginBottom: 10,
    },
    filterPanel: { backgroundColor: '#fff', borderRadius: 8, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#e8e8e8' },
    filterRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' },
    filterLabel: { fontSize: 12, fontWeight: '600', color: '#555' },
    filterChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#f8f9fa' },
    filterChipText: { fontSize: 12, color: '#555' },
    filterInput: { backgroundColor: '#f8f9fa', borderRadius: 6, padding: 6, fontSize: 12, borderWidth: 1, borderColor: '#e8e8e8', color: '#1a1a1a', width: 100 },
    clearBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: '#f0f0f0' },
    clearBtnText: { fontSize: 12, color: '#e74c3c', fontWeight: '600' },
})