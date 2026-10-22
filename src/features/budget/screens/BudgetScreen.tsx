import { useState } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'
import { useTheme, useStyles, Palette } from '../../../shared/theme/theme'
import { Page, PageTitle, Button, Segmented, useIsWide } from '../../../shared/ui/ui'
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog'
import { usePersistentState } from '../../../shared/usePersistentState'
import { useToastContext } from '../../../shared/ui/ToastContext'
import { useBudgetLogic } from '../logic/useBudgetLogic'
import { BudgetTable, BudgetViewProps } from './BudgetTable'
import { BudgetMonthView } from './BudgetMonthView'
import { PlanGuide } from './PlanGuide'
import { BudgetSimpleView } from './BudgetSimpleView'
import { SplitCategory } from './SplitCategory'
import { BudgetItem } from '../logic/types'

export default function BudgetScreen() {
    const logic = useBudgetLogic()
    const wide = useIsWide()
    const { c: C } = useTheme()
    const styles = useStyles(makeStyles)
    const [month, setMonth] = useState(new Date().getMonth() + 1)
    const [guideOpen, setGuideOpen] = useState(false)
    const [splitting, setSplitting] = useState<BudgetItem | null>(null)
    const [deleting, setDeleting] = useState<BudgetItem | null>(null)
    const [layout, setLayout] = usePersistentState<'simple' | 'months'>('budgetLayout', 'simple', ['simple', 'months'])
    const { showToast } = useToastContext()
    // An item's monthly amount right now: this month's, or its first planned month in another year
    const now = new Date()
    const isThisYear = logic.year === now.getFullYear()
    const shownMonth = isThisYear ? now.getMonth() + 1 : 1
    const amountFor = (itemId: string) => {
        if (isThisYear) {
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
        onDeleteItem: id => setDeleting(logic.items.find(i => i.id === id) ?? null),
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
            <Segmented<'simple' | 'months'>
                value={layout}
                onChange={v => { logic.setEditingCell(null); setLayout(v) }}
                options={[{ value: 'simple', label: 'Simple' }, { value: 'months', label: 'By month' }]}
                style={{ marginBottom: 14 }}
            />
            {logic.loading ? (
                <View style={styles.loading}>
                    <ActivityIndicator color={C.primary} />
                    <Text style={styles.loadingText}>Loading your budget…</Text>
                </View>
            ) : layout === 'simple' ? (
                <BudgetSimpleView
                    {...view}
                    month={shownMonth}
                    canStartLater={isThisYear && now.getMonth() > 0}
                    varies={logic.varies}
                    onSetEveryMonth={logic.handleSetEveryMonth}
                    onSetFrom={(itemId, m, value) => logic.handleCellSave(itemId, m, value, true)}
                    onEditMonths={() => { setMonth(shownMonth); setLayout('months') }}
                    onPlan={() => setGuideOpen(true)}
                    onSplit={setSplitting}
                />
            ) : wide ? (
                <BudgetTable {...view} />
            ) : (
                <BudgetMonthView {...view} month={month} onMonthChange={m => { logic.setEditingCell(null); setMonth(m) }} />
            )}
            <ConfirmDialog
                visible={!!deleting}
                title={`Delete ${deleting?.name}?`}
                message={`This removes ${deleting?.name} and its planned amounts for every month and year. Your transactions stay. You can undo it straight after.`}
                confirmLabel="Delete"
                onCancel={() => setDeleting(null)}
                onConfirm={() => { const id = deleting!.id; setDeleting(null); logic.handleDeleteItem(id) }}
            />
            {splitting && (
                <SplitCategory
                    item={splitting}
                    items={logic.items}
                    monthly={amountFor(splitting.id)}
                    onClose={() => setSplitting(null)}
                    onDone={([a, b], undo) => {
                        const name = splitting.name
                        showToast(`${name} is now ${a} and ${b}`, 'success', {
                            label: 'Undo',
                            onPress: async () => {
                                try {
                                    await undo()
                                    showToast(`${name} is back`)
                                } catch (e: any) {
                                    showToast(e?.message ?? `Couldn't undo the split`, 'error')
                                }
                                logic.reload()
                            },
                        })
                        setSplitting(null)
                        logic.reload()
                    }}
                />
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
