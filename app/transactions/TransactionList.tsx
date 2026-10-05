import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Pressable } from 'react-native'
import { TYPE_COLORS } from './types'
import { ImportModal } from './importModel'

interface Props {
    rows: any[]
    selectMode: boolean
    selected: Set<string>
    confirmDelete: boolean
    deleting: boolean
    search: string
    showFilters: boolean
    filterType: string | null
    filterFrom: string
    filterTo: string
    sortCol: string
    sortDir: 'asc' | 'desc'
    editMode: boolean
    onSearch: (v: string) => void
    onToggleFilters: () => void
    onFilterType: (v: string) => void
    onFilterFrom: (v: string) => void
    onFilterTo: (v: string) => void
    onClearFilters: () => void
    onSort: (col: string) => void
    onRowPress: (t: any) => void
    onEnterSelect: () => void
    onExitSelect: () => void
    onConfirmDelete: () => void
    onCancelConfirm: () => void
    onDelete: () => void
    onEnterEdit: () => void
    page: number
    totalPages: number
    onPageChange: (p: number) => void
    onExport: () => void    
    duplicateMode: boolean
    onEnterDuplicate: () => void
    showImport: boolean
    onImport: () => void
    onCloseImport: () => void
    onImported: () => void
}

const FILTER_TYPES = ['Income', 'Expense', 'Savings', 'Investment']
const TYPE_BADGE_COLORS: Record<string, string> = {
    income: '#2980b9',
    expense: '#e74c3c',
    savings: '#27ae60',
    investment: '#8e44ad',
}

export function TransactionList({
    rows, selectMode, selected, confirmDelete, deleting,
    search, showFilters, filterType, filterFrom, filterTo,
    sortCol, sortDir, editMode,
    page, totalPages, onPageChange,
    onSearch, onToggleFilters, onFilterType, onFilterFrom, onFilterTo, onClearFilters,
    onSort, onRowPress, onEnterSelect, onExitSelect, onConfirmDelete, onCancelConfirm, 
    onDelete, onEnterEdit, onExport, duplicateMode, onEnterDuplicate,
    showImport, onImport, onCloseImport, onImported,
}: Props) {
    return (
        
        <View style={styles.container}>
        {/* Header */}
        <View style={styles.listHeader}>
        <Text style={styles.sectionTitle}>Transactions</Text>
        <View style={styles.headerActions}>
        {selectMode ? (
            <>
            <Text style={styles.selectedCount}>{selected.size} selected</Text>
            {selected.size > 0 && !confirmDelete && (
                <TouchableOpacity style={styles.deleteBtn} onPress={onConfirmDelete}>
                <Text style={styles.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
            )}
            {confirmDelete && (
                <>
                <Text style={styles.confirmText}>Are you sure?</Text>
                <TouchableOpacity style={styles.deleteBtn} onPress={onDelete} disabled={deleting}>
                <Text style={styles.deleteBtnText}>{deleting ? 'Deleting...' : 'Confirm'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={onCancelConfirm}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                </>
            )}
            <TouchableOpacity style={styles.cancelBtn} onPress={onExitSelect}>
            <Text style={styles.cancelBtnText}>Exit</Text>
            </TouchableOpacity>
            </>
        ) : (
            <>
            <TouchableOpacity style={styles.actionBtn} onPress={onEnterSelect}>
            <Text style={styles.actionBtnText}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity
            style={[styles.actionBtn, editMode && { borderColor: '#e67e22' }]}
            onPress={onEnterEdit}
            >
            <Text style={[styles.actionBtnText, editMode && { color: '#e67e22' }]}>
            {editMode ? 'Click a Row...' : 'Edit'}
            </Text>
            </TouchableOpacity>
            <TouchableOpacity
            style={[styles.actionBtn, duplicateMode && { borderColor: '#8e44ad' }]}
            onPress={onEnterDuplicate}
            >
            <Text style={[styles.actionBtnText, duplicateMode && { color: '#8e44ad' }]}>
            {duplicateMode ? 'Click a Row...' : 'Duplicate'}
            </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={onToggleFilters}>
            <Text style={styles.actionBtnText}>{showFilters ? 'Hide Filters' : 'Filter'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={onExport}>
            <Text style={styles.actionBtnText}>Export CSV</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={onImport}>
            <Text style={styles.actionBtnText}>Import CSV</Text>
            </TouchableOpacity>
            </>
        )}
        </View>
        </View>
        {/* Search */}
        <TextInput
        style={styles.searchBar}
        placeholder="Search by name, category, or details..."
        value={search}
        onChangeText={onSearch}
        placeholderTextColor="#aaa"
        />
        
        {/* Filters */}
        {showFilters && (
            <View style={styles.filterPanel}>
            <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Type:</Text>
            {FILTER_TYPES.map(t => (
                <TouchableOpacity
                key={t}
                style={[styles.filterChip, filterType === t && { backgroundColor: TYPE_COLORS[t].bg }]}
                onPress={() => onFilterType(t)}
                >
                <Text style={[styles.filterChipText, filterType === t && { color: '#fff' }]}>{t}</Text>
                </TouchableOpacity>
            ))}
            </View>
            <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>From:</Text>
            <TextInput style={styles.filterInput} placeholder="YYYY-MM-DD" value={filterFrom} onChangeText={onFilterFrom} placeholderTextColor="#aaa" />
            <Text style={styles.filterLabel}>To:</Text>
            <TextInput style={styles.filterInput} placeholder="YYYY-MM-DD" value={filterTo} onChangeText={onFilterTo} placeholderTextColor="#aaa" />
            {(filterType || filterFrom || filterTo) && (
                <TouchableOpacity style={styles.clearBtn} onPress={onClearFilters}>
                <Text style={styles.clearBtnText}>Clear</Text>
                </TouchableOpacity>
            )}
            </View>
            </View>
        )}
        
        {/* Table Header */}
        <View style={styles.tableHeader}>
        {selectMode && <View style={styles.colCheck} />}
        <TouchableOpacity style={[styles.col, styles.colDate]} onPress={() => onSort('date')}>
        <Text style={styles.headerText}>Date {sortCol === 'date' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.col, styles.colType]} onPress={() => onSort('type')}>
        <Text style={styles.headerText}>Type {sortCol === 'type' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</Text>
        </TouchableOpacity>
        <Text style={[styles.col, styles.colCat, styles.headerText]}>Category</Text>
        <Text style={[styles.col, styles.colName, styles.headerText]}>Name</Text>
        <TouchableOpacity style={[styles.col, styles.colAmt]} onPress={() => onSort('amount')}>
        <Text style={styles.headerText}>Amount {sortCol === 'amount' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</Text>
        </TouchableOpacity>
        <Text style={[styles.col, styles.colDet, styles.headerText]}>Details</Text>
        <Text style={[styles.col, styles.colBal, styles.headerText]}>Balance</Text>
        </View>
        
        {/* Rows */}
        <ScrollView scrollEventThrottle={16} keyboardShouldPersistTaps="handled">
        {rows.length === 0 ? (
            <Text style={styles.empty}>No transactions found.</Text>
        ) : (
            rows.map((t, i) => {
                const isSelected = selected.has(t.id)
                return (
                    <Pressable
                    key={t.id}
                    style={({ pressed }) => [
                        styles.tableRow,
                        i % 2 === 0 ? styles.rowEven : styles.rowOdd,
                        isSelected && styles.rowSelected,
                        pressed && { opacity: 0.7 }
                    ]}
                    onPress={() => onRowPress(t)}
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
                    <View style={[styles.col, styles.colName, { flexDirection: 'row', alignItems: 'center', gap: 4, overflow: 'hidden' }]}>
                    <Text style={styles.cellText} numberOfLines={1}>{t.name || '—'}</Text>
                    {t.subscription_id ? (
                        <View
                        style={[styles.recurringBadge, { backgroundColor: TYPE_BADGE_COLORS[t.type] || '#888' }]}
                        {...{ title: 'Added by a subscription' } as any}
                        >
                        <Text style={styles.recurringBadgeText}>S</Text>
                        </View>
                    ) : null}
                    </View>
                    <Text style={[styles.col, styles.colAmt, styles.cellText, { color: t.type === 'expense' ? '#e74c3c' : '#27ae60' }]}>
                    {t.type === 'expense' ? '-' : '+'}${Number(t.amount).toFixed(2)}
                    </Text>
                    <Text style={[styles.col, styles.colDet, styles.cellText]}>{t.note || '—'}</Text>
                    <Text style={[styles.col, styles.colBal, styles.cellText]}>${Number(t.balance).toFixed(2)}</Text>
                    </Pressable>
                )
            })
        )}
        </ScrollView>
        {/* Summary Bar */}
        <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
        <Text style={styles.summaryLabel}>Showing</Text>
        <Text style={styles.summaryValue}>{rows.length} transactions</Text>
        </View>
        <View style={styles.summaryItem}>
        <Text style={styles.summaryLabel}>Income</Text>
        <Text style={[styles.summaryValue, { color: '#27ae60' }]}>
        +${rows.filter(t => t.type !== 'expense').reduce((s, t) => s + Number(t.amount), 0).toFixed(2)}
        </Text>
        </View>
        <View style={styles.summaryItem}>
        <Text style={styles.summaryLabel}>Expenses</Text>
        <Text style={[styles.summaryValue, { color: '#e74c3c' }]}>
        -${rows.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0).toFixed(2)}
        </Text>
        </View>
        <View style={styles.summaryItem}>
        <Text style={styles.summaryLabel}>Net</Text>
        <Text style={[styles.summaryValue, { color: '#2c3e50', fontWeight: '700' }]}>
        ${rows.reduce((s, t) => t.type === 'expense' ? s - Number(t.amount) : s + Number(t.amount), 0).toFixed(2)}
        </Text>
        </View>
        </View>
        
        {totalPages > 1 && (
            <View style={styles.pagination}>
            <TouchableOpacity
            style={[styles.pageBtn, page === 0 && styles.pageBtnDisabled]}
            onPress={() => onPageChange(page - 1)}
            disabled={page === 0}
            >
            <Text style={styles.pageBtnText}>← Prev</Text>
            </TouchableOpacity>
            <Text style={styles.pageInfo}>Page {page + 1} of {totalPages}</Text>
            <TouchableOpacity
            style={[styles.pageBtn, page === totalPages - 1 && styles.pageBtnDisabled]}
            onPress={() => onPageChange(page + 1)}
            disabled={page === totalPages - 1}
            >
            <Text style={styles.pageBtnText}>Next →</Text>
            </TouchableOpacity>
            </View>
        )}
        <ImportModal
        visible={showImport}
        onClose={onCloseImport}
        onImported={onImported}
        />
        </View>
        
    )
}

const styles = StyleSheet.create({
    container: { flex: 3, borderRightWidth: 1, borderColor: '#e0e0e0', padding: 16 },
    listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: '#2c3e50' },
    actionBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#2980b9' },
    actionBtnText: { fontSize: 13, color: '#2980b9', fontWeight: '600' },
    selectedCount: { fontSize: 13, color: '#555', fontWeight: '500' },
    deleteBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: '#e74c3c' },
    deleteBtnText: { fontSize: 13, color: '#fff', fontWeight: '600' },
    cancelBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#aaa' },
    cancelBtnText: { fontSize: 13, color: '#555', fontWeight: '600' },
    confirmText: { fontSize: 13, color: '#e74c3c', fontWeight: '500' },
    searchBar: { backgroundColor: '#f8f9fa', borderRadius: 8, padding: 10, fontSize: 13, borderWidth: 1, borderColor: '#e8e8e8', color: '#1a1a1a', marginBottom: 10 },
    filterPanel: { backgroundColor: '#fff', borderRadius: 8, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#e8e8e8' },
    filterRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' },
    filterLabel: { fontSize: 12, fontWeight: '600', color: '#555' },
    filterChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#f8f9fa' },
    filterChipText: { fontSize: 12, color: '#555' },
    filterInput: { backgroundColor: '#f8f9fa', borderRadius: 6, padding: 6, fontSize: 12, borderWidth: 1, borderColor: '#e8e8e8', color: '#1a1a1a', width: 100 },
    clearBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: '#f0f0f0' },
    clearBtnText: { fontSize: 12, color: '#e74c3c', fontWeight: '600' },
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
    summaryBar: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderColor: '#e0e0e0', paddingTop: 10, marginTop: 8, flexWrap: 'wrap', gap: 8 },
    summaryItem: { alignItems: 'center', minWidth: 80 },
    summaryLabel: { fontSize: 11, color: '#aaa', fontWeight: '500', marginBottom: 2 },
    summaryValue: { fontSize: 13, fontWeight: '600', color: '#2c3e50' },
    pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 10, gap: 16 },
    pageBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#2980b9' },
    pageBtnDisabled: { borderColor: '#ddd' },
    pageBtnText: { fontSize: 13, color: '#2980b9', fontWeight: '600' },
    pageInfo: { fontSize: 13, color: '#555' },
    recurringBadge: { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, alignItems: 'center', justifyContent: 'center' },
    recurringBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
})