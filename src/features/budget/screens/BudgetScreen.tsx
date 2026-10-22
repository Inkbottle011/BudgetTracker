import { useState } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'
import { useTheme, useStyles, Palette } from '../../../shared/theme/theme'
import { Page, PageTitle, Button, useIsWide } from '../../../shared/ui/ui'
import { useToastContext } from '../../../shared/ui/ToastContext'
import { useBudgetLogic } from '../logic/useBudgetLogic'
import { BudgetTable, BudgetViewProps } from './BudgetTable'
import { BudgetMonthView } from './BudgetMonthView'
import { PlanGuide } from './PlanGuide'

export default function BudgetScreen() {
    const logic = useBudgetLogic()
    const wide = useIsWide()
    const { c: C } = useTheme()
    const styles = useStyles(makeStyles)
    const [month, setMonth] = useState(new Date().getMonth() + 1)
    const [guideOpen, setGuideOpen] = useState(false)
    const { showToast } = useToastContext()
    // An item's monthly amount right now: this month's, or its first planned month in another year
    const amountFor = (itemId: string) => {
        const now = new Date()
        if (logic.year === now.getFullYear()) {
            const current = logic.getAmount(itemId, now.getMonth() + 1)
            if (current > 0) return current
        }
        for (let m = 1; m <= 12; m++) { const a = logic.getAmount(itemId, m); if (a > 0) return a }
        return 0
    }

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

    const actions = (
        <View style={styles.actions}>
            <Button label="Plan with questions" onPress={() => setGuideOpen(true)} disabled={logic.loading} />
            {yearSwitcher}
        </View>
    )

    return (
        <Page>
            <PageTitle title="Budget" subtitle="Plan how much comes in, goes out and gets saved each month." actions={actions} />
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
            {guideOpen && (
                <PlanGuide
                    year={logic.year}
                    items={logic.items}
                    amountFor={amountFor}
                    onClose={() => setGuideOpen(false)}
                    onSaved={({ added, updated }) => {
                        setGuideOpen(false)
                        showToast(`Budget updated: ${added} added, ${updated} updated`)
                        logic.reload()
                    }}
                />
            )}
        </Page>
    )
}

const makeStyles = (C: Palette) => StyleSheet.create({
    actions: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
    yearGroup: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    arrow: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    arrowText: { fontSize: 26, lineHeight: 28, color: C.muted },
    year: { fontSize: 22, fontWeight: '700', color: C.ink, minWidth: 64, textAlign: 'center', fontVariant: ['tabular-nums'] },
    loading: { alignItems: 'center', gap: 8, paddingVertical: 40 },
    loadingText: { fontSize: 14, color: C.muted },
})
