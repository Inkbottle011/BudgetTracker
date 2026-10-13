import { useState } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'
import { useTheme, useStyles, Palette } from '../../lib/theme'
import { Page, PageTitle, useIsWide } from '../../components/ui'
import { useBudgetLogic } from './useBudgetLogic'
import { BudgetTable, BudgetViewProps } from './BudgetTable'
import { BudgetMonthView } from './BudgetMonthView'

export default function BudgetScreen() {
    const logic = useBudgetLogic()
    const wide = useIsWide()
    const { c: C } = useTheme()
    const styles = useStyles(makeStyles)
    const [month, setMonth] = useState(new Date().getMonth() + 1)

    const view: BudgetViewProps = {
        items: logic.items,
        addingType: logic.addingType,
        newItemName: logic.newItemName,
        editingCell: logic.editingCell,
        editingValue: logic.editingValue,
        onSetAddingType: t => {
            logic.setAddingType(t)
            if (t) logic.setNewItemType(t)
        },
        onNewItemName: logic.setNewItemName,
        onAddItem: logic.handleAddItem,
        onDeleteItem: logic.handleDeleteItem,
        onCellPress: (itemId, m, current) => {
            logic.setEditingCell({ itemId, month: m })
            logic.setEditingValue(current > 0 ? String(current) : '')
        },
        onCellChange: logic.setEditingValue,
        onCellSave: (itemId, m, value, fillRight) => logic.handleCellSave(itemId, m, value, fillRight),
        onCellCancel: () => logic.setEditingCell(null),
        getAmount: logic.getAmount,
        getRowTotal: logic.getRowTotal,
        getMonthTotal: logic.getMonthTotal,
        getSectionTotal: logic.getSectionTotal,
        getNetByMonth: logic.getNetByMonth,
        getNetTotal: logic.getNetTotal,
    }

    const yearSwitcher = (
        <View style={styles.yearGroup}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Previous year" onPress={() => logic.setYear(logic.year - 1)} style={styles.arrow}>
                <Text style={styles.arrowText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.year}>{logic.year}</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Next year" onPress={() => logic.setYear(logic.year + 1)} style={styles.arrow}>
                <Text style={styles.arrowText}>›</Text>
            </TouchableOpacity>
        </View>
    )

    return (
        <Page>
            <PageTitle title="Budget" subtitle="Plan how much comes in, goes out and gets saved each month." actions={yearSwitcher} />
            {logic.loading ? (
                <View style={styles.loading}>
                    <ActivityIndicator color={C.primary} />
                    <Text style={styles.loadingText}>Loading your budget…</Text>
                </View>
            ) : wide ? (
                <BudgetTable {...view} />
            ) : (
                <BudgetMonthView {...view} month={month} onMonthChange={m => { logic.setEditingCell(null); setMonth(m) }} />
            )}
        </Page>
    )
}

const makeStyles = (C: Palette) => StyleSheet.create({
    yearGroup: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    arrow: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    arrowText: { fontSize: 26, lineHeight: 28, color: C.muted },
    year: { fontSize: 22, fontWeight: '700', color: C.ink, minWidth: 64, textAlign: 'center', fontVariant: ['tabular-nums'] },
    loading: { alignItems: 'center', gap: 8, paddingVertical: 40 },
    loadingText: { fontSize: 14, color: C.muted },
})
