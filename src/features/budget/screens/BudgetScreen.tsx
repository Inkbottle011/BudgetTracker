import { useState, useEffect } from 'react'
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
import { RenameCategory } from './RenameCategory'
import { UnplannedCategories } from './UnplannedCategories'
import { unplannedCategories } from '../logic/calculations'
import { renameBudgetItem, mergeBudgetItems, undoMerge, addBudgetItem } from '../logic/data'
import { useTransactionStore, loadAllTransactions, moveCategory, recategorize } from '../../transactions/api'
import { moveSubscriptionsOutOf, moveSubscriptionsBack } from '../../subscriptions/api'
import { BudgetItem } from '../logic/types'

export default function BudgetScreen() {
    const logic = useBudgetLogic()
    const wide = useIsWide()
    const { c: C } = useTheme()
    const styles = useStyles(makeStyles)
    const [month, setMonth] = useState(new Date().getMonth() + 1)
    const [guideOpen, setGuideOpen] = useState(false)
    const [splitting, setSplitting] = useState<BudgetItem | null>(null)
    const [renaming, setRenaming] = useState<BudgetItem | null>(null)
    const stored = useTransactionStore(st => st.transactions)
    const [loadedTx, setLoadedTx] = useState<any[] | null>(null)
    useEffect(() => { if (!stored.length) loadAllTransactions().then(t => { if (t) setLoadedTx(t) }).catch(() => {}) }, [])
    const transactions = (stored.length ? stored : loadedTx ?? []) as any[]
    const unplanned = unplannedCategories(transactions, logic.items)

    /** Renames an item (with its transactions and subscriptions), or combines it into `into`; with Undo. */
    async function rename(item: BudgetItem, name: string, into: BudgetItem | null) {
        const to = into ? into.name : name
        const moved = await moveCategory({ from: item.name, to, kind: item.type })
        const subs = await moveSubscriptionsOutOf(item.name, () => to)
        const merged = into ? await mergeBudgetItems(item, into) : null
        if (!into) await renameBudgetItem(item.id, name)
        setRenaming(null)
        logic.reload()
        showToast(into ? `${item.name} is now part of ${into.name}` : `${item.name} is now called ${name}`, 'success', {
            label: 'Undo',
            onPress: async () => {
                try {
                    if (merged) await undoMerge(merged)
                    else await renameBudgetItem(item.id, item.name)
                    if (moved.length) await recategorize([{ category: item.name, ids: moved }])
                    await moveSubscriptionsBack(subs, item.name)
                    showToast(`${item.name} is back`)
                } catch (e: any) {
                    showToast(e?.message ?? "Couldn't undo that", 'error')
                }
                logic.reload()
            },
        })
    }

    async function moveUnplanned(from: string, to: string) {
        try {
            const ids = await moveCategory({ from, to, kind: 'expense' })
            showToast(`Moved ${ids.length} transaction${ids.length === 1 ? '' : 's'} to ${to}`, 'success', {
                label: 'Undo',
                onPress: async () => {
                    try { await recategorize([{ category: from, ids }]); showToast(`Moved them back to ${from}`) }
                    catch (e: any) { showToast(e?.message ?? "Couldn't undo that", 'error') }
                },
            })
        } catch (e: any) {
            showToast(e?.message ?? "Couldn't move them", 'error')
        }
    }

    async function addUnplanned(name: string) {
        try { await addBudgetItem(name, 'expense'); showToast(`${name} added to your budget`); logic.reload() }
        catch (e: any) { showToast(e?.message ?? `Couldn't add ${name}`, 'error') }
    }
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
            {!logic.loading && logic.yearIsEmpty && (
                <View style={styles.copyCard}>
                    <View style={{ flex: 1, minWidth: 200 }}>
                        <Text style={styles.copyTitle}>Nothing planned for {logic.year} yet</Text>
                        <Text style={styles.copyBody}>Start from last year's amounts and change what's different, or answer a few questions.</Text>
                    </View>
                    <Button label={`Copy ${logic.year - 1}'s budget`} onPress={logic.handleCopyLastYear} />
                </View>
            )}
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
                    onRename={setRenaming}
                    footer={<UnplannedCategories categories={unplanned} choices={logic.items.filter(i => i.type === 'expense').map(i => i.name)} onMove={moveUnplanned} onAdd={addUnplanned} />}
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
            {renaming && (
                <RenameCategory item={renaming} items={logic.items} onClose={() => setRenaming(null)} onRename={(name, into) => rename(renaming, name, into)} />
            )}
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
    copyCard: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap', backgroundColor: C.primarySoft, borderRadius: 14, padding: 16, marginBottom: 14 },
    copyTitle: { fontSize: 15, fontWeight: '700', color: C.ink },
    copyBody: { fontSize: 13, color: C.text, marginTop: 2, lineHeight: 18 },
    yearGroup: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    arrow: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    arrowText: { fontSize: 26, lineHeight: 28, color: C.muted },
    year: { fontSize: 22, fontWeight: '700', color: C.ink, minWidth: 64, textAlign: 'center', fontVariant: ['tabular-nums'] },
    loading: { alignItems: 'center', gap: 8, paddingVertical: 40 },
    loadingText: { fontSize: 14, color: C.muted },
})
