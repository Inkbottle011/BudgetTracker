import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { BudgetType, MONTHS, SECTION_COLORS } from './types'

interface Props {
    year: number
    items: any[]
    loading: boolean
    addingType: BudgetType | null
    newItemName: string
    newItemType: BudgetType
    editingCell: { itemId: string; month: number } | null
    editingValue: string
    onYearChange: (y: number) => void
    onSetAddingType: (t: BudgetType | null) => void
    onNewItemName: (v: string) => void
    onNewItemType: (t: BudgetType) => void
    onAddItem: () => void
    onDeleteItem: (id: string) => void
    onCellPress: (itemId: string, month: number, current: number) => void
    onCellChange: (v: string) => void
    onCellSave: (itemId: string, month: number, value: string, fillRight: boolean) => void
    onCellCancel: () => void
    getAmount: (itemId: string, month: number) => number
    getRowTotal: (itemId: string) => number
    getMonthTotal: (type: BudgetType, month: number) => number
    getSectionTotal: (type: BudgetType) => number
    getNetByMonth: (month: number) => number
    getNetTotal: () => number
}

const SECTIONS: BudgetType[] = ['income', 'expense', 'savings', 'investment']

export function BudgetTable({
    year, items, loading,
    addingType, newItemName,
    editingCell, editingValue,
    onYearChange, onSetAddingType, onNewItemName,
    onAddItem, onDeleteItem, onCellPress, onCellChange, onCellSave, onCellCancel,
    getAmount, getRowTotal, getMonthTotal, getSectionTotal,getNetByMonth, getNetTotal,
}: Props) {
    
    function renderSection(type: BudgetType) {
        const colors = SECTION_COLORS[type]
        const sectionItems = items.filter(i => i.type === type)
        const label = type.charAt(0).toUpperCase() + type.slice(1)
        
        return (
            
            <View key={type} style={[styles.section, { borderColor: colors.border }]}>
            {/* Section Header */}
            <View style={[styles.sectionHeader, { backgroundColor: colors.header }]}>
            <Text style={styles.sectionHeaderText}>{label}</Text>
            {MONTHS.map((m) => (
                <Text key={m} style={styles.sectionHeaderCell}>{m}</Text>
            ))}
            <Text style={styles.sectionHeaderTotal}>Total</Text>
            <View style={styles.colAction} />
            </View>
            
            {/* Rows */}
            {sectionItems.map(item => (
                <View key={item.id} style={[styles.row, { backgroundColor: colors.light }]}>
                <View style={styles.colName}>
                <Text style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
                </View>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
                    const isEditing = editingCell?.itemId === item.id && editingCell?.month === month
                    const amount = getAmount(item.id, month)
                    return (
                        <TouchableOpacity
                        key={month}
                        style={styles.cell}
                        onPress={() => {
                            if (editingCell) return
                            onCellPress(item.id, month, amount)
                        }}
                        >
                        {isEditing ? (
                            <View style={styles.cellEditContainer}>
                            <TextInput
                            style={styles.cellInput}
                            value={editingValue}
                            onChangeText={onCellChange}
                            keyboardType="decimal-pad"
                            autoFocus
                            placeholderTextColor="#aaa"
                            />
                            <View style={styles.cellActions}>
                            <TouchableOpacity
                            style={styles.cellActionBtn}
                            onPress={() => onCellSave(item.id, month, editingValue, false)}
                            // @ts-ignore
                            title="Save this month only"
                            >
                            <Text style={styles.cellActionText}>✓</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                            style={[styles.cellActionBtn, { backgroundColor: colors.header }]}
                            onPress={() => onCellSave(item.id, month, editingValue, true)}
                            // @ts-ignore
                            title="Fill this month and all months to the right"
                            >
                            <Text style={[styles.cellActionText, { color: '#fff' }]}>→</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                            style={styles.cellActionBtn}
                            onPress={() => onCellCancel()}
                            // @ts-ignore
                            title="Cancel"
                            >
                            <Text style={[styles.cellActionText, { color: '#e74c3c' }]}>✕</Text>
                            </TouchableOpacity>
                            </View>
                            </View>
                        ) : (
                            <Text style={[styles.cellText, amount > 0 && { color: colors.text, fontWeight: '500' }]}>
                            {amount > 0 ? `$${amount.toLocaleString()}` : ''}
                            </Text>
                        )}
                        </TouchableOpacity>
                    )
                })}
                <Text style={[styles.rowTotal, { color: colors.text }]}>
                ${getRowTotal(item.id).toLocaleString()}
                </Text>
                <TouchableOpacity style={styles.colAction} onPress={() => onDeleteItem(item.id)}>
                <Text style={styles.deleteIcon}>✕</Text>
                </TouchableOpacity>
                </View>
            ))}
            
            {/* Add Row */}
            {addingType === type ? (
                <View style={[styles.row, { backgroundColor: colors.light }]}>
                <View style={styles.colName}>
                <TextInput
                style={styles.addInput}
                placeholder="Name..."
                value={newItemName}
                onChangeText={onNewItemName}
                autoFocus
                placeholderTextColor="#aaa"
                />
                </View>
                <TouchableOpacity style={[styles.addConfirmBtn, { backgroundColor: colors.header }]} onPress={onAddItem}>
                <Text style={styles.addConfirmText}>Add</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.addCancelBtn} onPress={() => onSetAddingType(null)}>
                <Text style={styles.addCancelText}>Cancel</Text>
                </TouchableOpacity>
                </View>
            ) : (
                <TouchableOpacity
                style={[styles.addRowBtn, { borderColor: colors.border }]}
                onPress={() => onSetAddingType(type)}
                >
                <Text style={[styles.addRowText, { color: colors.text }]}>+ Add {label} Item</Text>
                </TouchableOpacity>
            )}
            
            {/* Section Total Row */}
            <View style={[styles.totalRow, { backgroundColor: colors.header }]}>
            <Text style={styles.totalLabel}>Total</Text>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                <Text key={month} style={styles.totalCell}>
                ${getMonthTotal(type, month).toLocaleString()}
                </Text>
            ))}
            <Text style={styles.totalCell}>${getSectionTotal(type).toLocaleString()}</Text>
            <View style={styles.colAction} />
            </View>
            </View>
        )
    }
    
    return (
        <View style={styles.container}>
        {/* Year Selector */}
        <View style={styles.yearBar}>
        <TouchableOpacity onPress={() => onYearChange(year - 1)} style={styles.yearBtn}>
        <Text style={styles.yearBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.yearText}>{year}</Text>
        <TouchableOpacity onPress={() => onYearChange(year + 1)} style={styles.yearBtn}>
        <Text style={styles.yearBtnText}>→</Text>
        </TouchableOpacity>
        </View>
        
        {loading ? (
            <Text style={styles.loading}>Loading...</Text>
        ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <ScrollView>
            {/* Net Row */}
            <View style={styles.netRow}>
            <Text style={styles.netLabel}>Net</Text>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
                const net = getNetByMonth(month)
                return (
                    <Text key={month} style={[styles.netCell, { color: net >= 0 ? '#27ae60' : '#e74c3c' }]}>
                    {net >= 0 ? '+' : ''}${net.toLocaleString()}
                    </Text>
                )
            })}
            <Text style={[styles.netCell, styles.netTotal, { color: getNetTotal() >= 0 ? '#27ae60' : '#e74c3c' }]}>
            {getNetTotal() >= 0 ? '+' : ''}${getNetTotal().toLocaleString()}
            </Text>
            <View style={styles.colAction} />
            </View>
            {SECTIONS.map(renderSection)}
            </ScrollView>
            </ScrollView>
        )}
        </View>
    )
}

const COL_WIDTH = 80
const NAME_WIDTH = 160
const ACTION_WIDTH = 36

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f6fa', padding: 16 },
    yearBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16, gap: 16 },
    yearBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#2980b9' },
    yearBtnText: { fontSize: 16, color: '#2980b9', fontWeight: '700' },
    yearText: { fontSize: 22, fontWeight: '700', color: '#2c3e50', minWidth: 60, textAlign: 'center' },
    loading: { textAlign: 'center', color: '#aaa', marginTop: 40 },
    section: { marginBottom: 24, borderRadius: 8, overflow: 'hidden', borderWidth: 1 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4 },
    sectionHeaderText: { width: NAME_WIDTH, color: '#fff', fontWeight: '700', fontSize: 14, paddingLeft: 8 },
    sectionHeaderCell: { width: COL_WIDTH, color: '#fff', fontWeight: '600', fontSize: 12, textAlign: 'center' },
    sectionHeaderTotal: { width: COL_WIDTH, color: '#fff', fontWeight: '700', fontSize: 12, textAlign: 'center' },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 4, borderTopWidth: 0.5, borderColor: '#ddd' },
    colName: { width: NAME_WIDTH, paddingLeft: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
    colAction: { width: ACTION_WIDTH, alignItems: 'center' },
    itemName: { fontSize: 13, fontWeight: '500', flex: 1 },
    cell: { width: COL_WIDTH, alignItems: 'center', paddingVertical: 4 },
    cellEditContainer: { alignItems: 'center' },
    cellInput: { width: COL_WIDTH - 8, borderWidth: 1, borderColor: '#2980b9', borderRadius: 4, padding: 4, fontSize: 12, textAlign: 'center', backgroundColor: '#fff' },
    cellActions: { flexDirection: 'row', gap: 2, marginTop: 2 },
    cellActionBtn: { width: 22, height: 22, borderRadius: 4, borderWidth: 1, borderColor: '#ddd', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f9fa' },
    cellActionText: { fontSize: 11, fontWeight: '700', color: '#555' },
    cellText: { fontSize: 12, color: '#aaa', textAlign: 'center' },
    rowTotal: { width: COL_WIDTH, fontSize: 13, fontWeight: '700', textAlign: 'center' },
    deleteIcon: { fontSize: 12, color: '#e74c3c' },
    addRowBtn: { padding: 10, alignItems: 'center', borderTopWidth: 0.5, borderStyle: 'dashed' },
    addRowText: { fontSize: 13, fontWeight: '600' },
    addInput: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 6, fontSize: 13, backgroundColor: '#fff' },
    addConfirmBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, marginLeft: 8 },
    addConfirmText: { color: '#fff', fontWeight: '600', fontSize: 13 },
    addCancelBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#ddd', marginLeft: 4 },
    addCancelText: { color: '#555', fontSize: 13 },
    totalRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4 },
    totalLabel: { width: NAME_WIDTH, color: '#fff', fontWeight: '700', fontSize: 13, paddingLeft: 8 },
    totalCell: { width: COL_WIDTH, color: '#fff', fontWeight: '700', fontSize: 12, textAlign: 'center' },
    netRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2c3e50', borderRadius: 8, padding: 8, marginBottom: 16 },
    netLabel: { width: NAME_WIDTH, color: '#fff', fontWeight: '700', fontSize: 14, paddingLeft: 8 },
    netCell: { width: COL_WIDTH, fontSize: 12, fontWeight: '600', textAlign: 'center' },
    netTotal: { fontSize: 13, fontWeight: '700' },
})