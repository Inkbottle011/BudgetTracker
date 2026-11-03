import { View, Text, TextInput, TouchableOpacity, StyleSheet, Pressable } from 'react-native'
import { Button, Chip, Field, TypeBadge, EmptyState } from '../../../shared/ui/ui'
import { useTheme, useStyles, Palette, tabular } from '../../../shared/theme/theme'
import { todayString } from '../../../shared/money/entry'
import { formatMoney } from '../../../shared/money/format'
import { TRANSACTION_TYPES } from '../logic/types'
import { listSummary, displayDate, amountText, describeFilters, DATE_PRESETS, DatePreset, UNCATEGORIZED } from '../logic/listLogic'
import { ImportModal } from './ImportModal'
import { Private } from '../../../shared/ui/Private'

interface Props {
    rows: any[]
    /** Computer layout (columns) or phone layout (stacked rows) */
    wide: boolean
    /** Whether there are any transactions at all, before search and filters */
    hasTransactions: boolean
    /** Whether a search or filter is narrowing the list */
    filtering: boolean
    /** The transaction open in the form, highlighted in the list */
    activeId?: string | null
    selectMode: boolean
    selected: Set<string>
    confirmDelete: boolean
    deleting: boolean
    search: string
    showFilters: boolean
    filterType: string | null
    filterFrom: string
    filterTo: string
    filterCategory: string | null
    datePreset: DatePreset
    /** Categories to filter by */
    categories: string[]
    /** Every row matching the filters (not just this page), for the totals */
    allRows: any[]
    sortCol: string
    sortDir: 'asc' | 'desc'
    onSearch: (v: string) => void
    onToggleFilters: () => void
    onFilterType: (v: string) => void
    onFilterFrom: (v: string) => void
    onFilterTo: (v: string) => void
    onClearFilters: () => void
    onFilterCategory: (v: string | null) => void
    onDatePreset: (v: DatePreset) => void
    onSort: (col: string) => void
    onRowPress: (t: any) => void
    onEnterSelect: () => void
    onExitSelect: () => void
    onConfirmDelete: () => void
    onCancelConfirm: () => void
    onDelete: () => void
    page: number
    totalPages: number
    onPageChange: (p: number) => void
    onExport: () => void
    showImport: boolean
    onImport: () => void
    onCloseImport: () => void
    onImported: () => void
}

export function TransactionList({
    rows, wide, hasTransactions, filtering, activeId,
    selectMode, selected, confirmDelete, deleting,
    search, showFilters, filterType, filterFrom, filterTo, filterCategory, datePreset, categories, allRows,
    onFilterCategory, onDatePreset,
    sortCol, sortDir,
    page, totalPages, onPageChange,
    onSearch, onToggleFilters, onFilterType, onFilterFrom, onFilterTo, onClearFilters,
    onSort, onRowPress, onEnterSelect, onExitSelect, onConfirmDelete, onCancelConfirm,
    onDelete, onExport,
    showImport, onImport, onCloseImport, onImported,
}: Props) {
    const { c: C } = useTheme()
    const styles = useStyles(makeStyles)
    const today = todayString()
    const summary = listSummary(rows)
    const described = describeFilters({ type: filterType, category: filterCategory, from: filterFrom, to: filterTo }, today)
    const all = listSummary(allRows)
    const totalsLine = [
        `${allRows.length} transaction${allRows.length === 1 ? '' : 's'}`,
        all.income ? `${formatMoney(all.income)} in` : null,
        all.spent ? `${formatMoney(all.spent)} out` : null,
    ].filter(Boolean).join(' · ')
    const n = selected.size
    const amountColor = (d: 'in' | 'out' | 'move') => (d === 'in' ? C.good : d === 'move' ? C.move : C.ink)

    const sortHeader = (col: string, label: string, style: any) => (
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Sort by ${label.toLowerCase()}`} onPress={() => onSort(col)} style={style}>
            <Text style={[styles.headText, sortCol === col && styles.headTextOn, col === 'amount' && { textAlign: 'right' }]}>
                {label}{sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
            </Text>
        </TouchableOpacity>
    )

    return (
        <View>
            {/* Search and tools */}
            <TextInput
                accessibilityLabel="Search transactions"
                style={styles.search}
                placeholder="Search by name, category, or details..."
                value={search}
                onChangeText={onSearch}
                placeholderTextColor={C.faint}
            />
            <View style={styles.tools}>
                {selectMode ? (
                    <>
                        <Text style={styles.selectedCount}>{n} selected</Text>
                        {confirmDelete ? (
                            <>
                                <Text style={styles.confirmText}>Are you sure?</Text>
                                <Button small variant="danger" label={deleting ? 'Deleting...' : `Yes, delete ${n}`} onPress={onDelete} disabled={deleting} />
                                <Button small variant="secondary" label="Cancel" onPress={onCancelConfirm} disabled={deleting} />
                            </>
                        ) : (
                            <>
                                {n > 0 && <Button small variant="danger" label={`Delete ${n}`} onPress={onConfirmDelete} />}
                                <Button small variant="secondary" label="Cancel" onPress={onExitSelect} />
                            </>
                        )}
                    </>
                ) : (
                    <>
                        <Button small variant="secondary" label={showFilters ? 'Hide filters' : 'Filter'} onPress={onToggleFilters} />
                        <Button small variant="secondary" label="Export CSV" onPress={onExport} />
                        <Button small variant="secondary" label="Import CSV" onPress={onImport} />
                        <Button small variant="secondary" label="Select" accessibilityLabel="Select transactions to delete" onPress={onEnterSelect} />
                    </>
                )}
            </View>

            {/* Filters */}
            {showFilters && (
                <View style={styles.filters} accessibilityLabel="Filters">
                    <Text style={styles.label}>Type</Text>
                    <View style={styles.chips}>
                        {TRANSACTION_TYPES.map(t => (
                            <Chip key={t} label={t} tone={t.toLowerCase()} selected={filterType === t} onPress={() => onFilterType(t)} />
                        ))}
                    </View>
                    <Text style={styles.label}>Dates</Text>
                    <View style={styles.chips}>
                        {DATE_PRESETS.map(p => (
                            <Chip key={p.value} label={p.label} selected={datePreset === p.value} onPress={() => onDatePreset(p.value)} />
                        ))}
                    </View>
                    {datePreset === 'custom' && (
                        <View style={styles.dates}>
                            <View style={styles.dateField}>
                                <Field label="From" placeholder="YYYY-MM-DD" value={filterFrom} onChangeText={onFilterFrom} />
                            </View>
                            <View style={styles.dateField}>
                                <Field label="To" placeholder="YYYY-MM-DD" value={filterTo} onChangeText={onFilterTo} />
                            </View>
                        </View>
                    )}
                    <Text style={styles.label}>Category</Text>
                    <View style={styles.chips}>
                        {categories.map(c => (
                            <Chip key={c} label={c} selected={filterCategory?.toLowerCase() === c.toLowerCase()} onPress={() => onFilterCategory(filterCategory?.toLowerCase() === c.toLowerCase() ? null : c)} />
                        ))}
                        <Chip label="Uncategorized" selected={filterCategory === UNCATEGORIZED} onPress={() => onFilterCategory(filterCategory === UNCATEGORIZED ? null : UNCATEGORIZED)} />
                    </View>
                    {(filterType || filterFrom || filterTo || filterCategory) && (
                        <Button variant="ghost" label="Clear filters" onPress={onClearFilters} style={{ alignSelf: 'flex-start' }} />
                    )}
                </View>
            )}

            {/* What the list is narrowed to, with its totals */}
            {!!described && (
                <View style={styles.active}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.activeTitle}>{described}</Text>
                        <Text style={[styles.activeTotals, tabular]}><Private kind="totals">{totalsLine}</Private></Text>
                    </View>
                    <Button small variant="secondary" label="Clear" accessibilityLabel="Clear" onPress={onClearFilters} />
                </View>
            )}

            {/* Rows */}
            <View style={styles.box}>
                {wide && rows.length > 0 && (
                    <View style={styles.head}>
                        {selectMode && <View style={styles.checkCol} />}
                        {sortHeader('date', 'Date', styles.dateCol)}
                        <Text style={[styles.headText, styles.nameCol]}>Name</Text>
                        {sortHeader('type', 'Type', styles.typeCol)}
                        {sortHeader('amount', 'Amount', styles.amountCol)}
                    </View>
                )}

                {rows.length === 0 && (
                    hasTransactions || filtering ? (
                        <EmptyState
                            title="Nothing matches"
                            body="Try a different search, or clear the filters."
                            action={<Button small variant="secondary" label="Clear search and filters" onPress={() => { onSearch(''); onClearFilters() }} />}
                        />
                    ) : (
                        <EmptyState title="No transactions yet" body="Add your first one, import a CSV, or link a bank in Settings." />
                    )
                )}

                {rows.map((t, i) => {
                    const isSelected = selected.has(t.id)
                    const amount = amountText(t)
                    const name = t.name || t.note || 'Transaction'
                    const date = displayDate(t.date, today)
                    const sub = wide
                        ? [t.category_label, t.note && t.note !== name ? t.note : null, t.subscription_id ? 'From a subscription' : null]
                        : [t.category_label, date]
                    const subText = sub.filter(Boolean).join(' · ')
                    return (
                        <Pressable
                            key={t.id}
                            accessibilityRole={selectMode ? 'checkbox' : 'button'}
                            accessibilityState={selectMode ? { checked: isSelected } : undefined}
                            accessibilityHint={selectMode ? undefined : 'Opens it for editing'}
                            onPress={() => onRowPress(t)}
                            style={({ pressed }) => [
                                styles.row,
                                i > 0 && styles.rowLine,
                                (isSelected || (!selectMode && activeId === t.id)) && styles.rowOn,
                                pressed && styles.rowPressed,
                            ]}
                        >
                            {selectMode && (
                                <View style={styles.checkCol}>
                                    <View style={[styles.checkbox, isSelected && styles.checkboxOn]}>
                                        {isSelected && <Text style={styles.checkmark}>✓</Text>}
                                    </View>
                                </View>
                            )}
                            {wide && <Text style={[styles.date, tabular, styles.dateCol]}>{date}</Text>}
                            <View style={styles.nameCol}>
                                <Text style={styles.name} numberOfLines={2}>{name}</Text>
                                {subText ? <Text style={styles.sub} numberOfLines={1}>{subText}</Text> : null}
                            </View>
                            {wide && <View style={styles.typeCol}><TypeBadge type={t.type} /></View>}
                            <Text style={[styles.amount, tabular, wide && styles.amountCol, { color: amountColor(amount.direction) }]}>
                                <Private kind="transactions">{amount.text}</Private>
                            </Text>
                        </Pressable>
                    )
                })}
            </View>

            {/* Totals for what's shown */}
            {rows.length > 0 && (
                <View style={styles.summary}>
                    <SummaryItem label="Showing" value={`${rows.length} transaction${rows.length === 1 ? '' : 's'}`} styles={styles} />
                    <SummaryItem label="Income" value={formatMoney(summary.income, { sign: true })} color={C.good} styles={styles} />
                    <SummaryItem label="Spent" value={formatMoney(-summary.spent)} styles={styles} />
                    <SummaryItem label="Net" value={formatMoney(summary.net, { sign: true })} styles={styles} bold />
                </View>
            )}

            {totalPages > 1 && (
                <View style={styles.pagination}>
                    <Button small variant="secondary" label="Previous" onPress={() => onPageChange(page - 1)} disabled={page === 0} />
                    <Text style={styles.pageInfo}>Page {page + 1} of {totalPages}</Text>
                    <Button small variant="secondary" label="Next" onPress={() => onPageChange(page + 1)} disabled={page === totalPages - 1} />
                </View>
            )}

            <ImportModal visible={showImport} onClose={onCloseImport} onImported={onImported} />
        </View>
    )
}

function SummaryItem({ label, value, color, bold, styles }: { label: string; value: string; color?: string; bold?: boolean; styles: ReturnType<typeof makeStyles> }) {
    return (
        <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>{label}</Text>
            <Text style={[styles.summaryValue, tabular, color ? { color } : null, bold && { fontWeight: '700' }]}><Private kind="totals">{value}</Private></Text>
        </View>
    )
}

const makeStyles = (C: Palette) => StyleSheet.create({
    search: {
        backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.line,
        paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: C.ink, marginBottom: 10,
    },
    tools: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 12 },
    selectedCount: { fontSize: 14, fontWeight: '600', color: C.ink, marginRight: 4 },
    confirmText: { fontSize: 14, color: C.bad, fontWeight: '500' },
    active: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.primarySoft, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12 },
    activeTitle: { fontSize: 14, fontWeight: '700', color: C.ink },
    activeTotals: { fontSize: 13, color: C.text, marginTop: 2 },
    filters: { backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 16, marginBottom: 12 },
    label: { fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 6 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
    dates: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
    dateField: { flex: 1, minWidth: 130 },
    box: { backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
    head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderColor: C.line },
    headText: { fontSize: 12, fontWeight: '600', color: C.muted },
    headTextOn: { color: C.ink },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight: 56 },
    rowLine: { borderTopWidth: 1, borderColor: C.line },
    rowOn: { backgroundColor: C.primarySoft },
    rowPressed: { backgroundColor: C.surfaceAlt },
    checkCol: { width: 22, alignItems: 'center' },
    checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: C.muted, alignItems: 'center', justifyContent: 'center' },
    checkboxOn: { backgroundColor: C.primary, borderColor: C.primary },
    checkmark: { color: C.onPrimary, fontSize: 12, fontWeight: '700', lineHeight: 14 },
    dateCol: { width: 76 },
    nameCol: { flex: 1, minWidth: 0 },
    typeCol: { width: 124 }, // fits the "Reimbursement" badge
    amountCol: { width: 112 },
    date: { fontSize: 13, color: C.muted },
    name: { fontSize: 15, color: C.ink, fontWeight: '500', lineHeight: 20 },
    sub: { fontSize: 12, color: C.muted, marginTop: 2 },
    amount: { fontSize: 15, fontWeight: '600', textAlign: 'right' },
    summary: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, paddingHorizontal: 4, paddingTop: 12 },
    summaryItem: { minWidth: 72 },
    summaryLabel: { fontSize: 12, color: C.muted, marginBottom: 2 },
    summaryValue: { fontSize: 14, fontWeight: '600', color: C.ink },
    pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, paddingTop: 14 },
    pageInfo: { fontSize: 13, color: C.muted },
})
