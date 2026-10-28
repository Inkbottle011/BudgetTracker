import { useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { Section, Button } from '../../../shared/ui/ui'
import { useTheme, useStyles, Palette, tabular } from '../../../shared/theme/theme'
import { formatMoney } from '../../../shared/money/format'
import { supabase } from '../../../shared/supabase'
import { buildCategoryGuesser } from '../../../shared/money/entry'
import { groupUncategorized, categoriesFor, UncategorizedGroup } from '../logic/categorize'
import { DEFAULT_CATEGORIES } from '../logic/types'
import { useToastContext } from '../../../shared/ui/ToastContext'
import { Private } from '../../../shared/ui/Private'

interface Props {
    transactions: any[]
    /** Your budget categories by type ('Expense': [...], ...) */
    budgetCategories: Record<string, string[]>
    onChanged: () => void
}

const SHOWN = 15
const money = (n: number) => formatMoney(n)
const TYPES = ['income', 'expense', 'savings', 'investment']

/**
 * Transactions without a category, grouped by place, so a whole place is categorized at once.
 * What you pick is learned: future imports from the same place get the same category.
 */
export function UncategorizedPanel({ transactions, budgetCategories, onChanged }: Props) {
    const { showToast } = useToastContext()
    const { c: C } = useTheme()
    const styles = useStyles(makeStyles)
    const [open, setOpen] = useState(false)
    const [choosing, setChoosing] = useState<string | null>(null)
    const [busy, setBusy] = useState<string | null>(null)
    const [showAll, setShowAll] = useState(false)

    const { groups, available } = useMemo(() => {
        // Your categories for each type: your budget's, plus any you've used on a transaction
        const available: Record<string, string[]> = {}
        for (const type of TYPES) {
            const key = type.charAt(0).toUpperCase() + type.slice(1)
            const fromBudget = budgetCategories[key] ?? []
            const used = transactions.filter(t => t.type === type && t.category_label).map(t => String(t.category_label))
            const base = fromBudget.length ? fromBudget : (DEFAULT_CATEGORIES[key] ?? [])
            available[type] = [...new Set([...base, ...used])]
        }
        const history = transactions.filter(t => t.category_label)
        return { groups: groupUncategorized(transactions, available, buildCategoryGuesser(history)), available }
    }, [transactions, budgetCategories])

    if (!groups.length) return null
    const count = groups.reduce((n, g) => n + g.count, 0)
    const suggested = groups.filter(g => g.suggestion)

    async function save(ids: string[], category: string) {
        for (let i = 0; i < ids.length; i += 200) {
            const { error } = await supabase.from('transactions').update({ category_label: category }).in('id', ids.slice(i, i + 200))
            if (error) throw new Error(error.message)
        }
    }

    async function apply(group: UncategorizedGroup, category: string) {
        setBusy(group.key)
        try {
            await save(group.ids, category)
            showToast(`${group.count} ${group.name} transaction${group.count === 1 ? '' : 's'} set to ${category}. New ones will be too.`)
            setChoosing(null)
            onChanged()
        } catch (e: any) {
            showToast(`Couldn't save categories: ${e.message}`, 'error')
        }
        setBusy(null)
    }

    async function applyAll() {
        setBusy('all')
        try {
            // One save per category rather than per place
            const byCategory = new Map<string, string[]>()
            for (const g of suggested) byCategory.set(g.suggestion!, [...(byCategory.get(g.suggestion!) ?? []), ...g.ids])
            for (const [category, ids] of byCategory) await save(ids, category)
            const n = suggested.reduce((s, g) => s + g.count, 0)
            showToast(`Categorized ${n} transaction${n === 1 ? '' : 's'}`)
            onChanged()
        } catch (e: any) {
            showToast(`Couldn't save categories: ${e.message}`, 'error')
        }
        setBusy(null)
    }

    const shown = showAll ? groups : groups.slice(0, SHOWN)

    const title = `${count} transaction${count === 1 ? '' : 's'} without a category (${groups.length} place${groups.length === 1 ? '' : 's'})`

    return (
        <Section
            title={title}
            action={<Button small variant="secondary" label={open ? 'Hide' : 'Review'} onPress={() => setOpen(o => !o)} />}
        >
            {!open && <Text style={styles.help}>Categorize them so your budget counts them.</Text>}
            {open && (
                <>
                    <Text style={styles.help}>Pick a category once per place; future transactions from it are categorized automatically.</Text>
                    {suggested.length > 0 && (
                        <Button
                            small
                            label={`Apply all ${suggested.length} suggestion${suggested.length === 1 ? '' : 's'}`}
                            onPress={applyAll}
                            disabled={!!busy}
                            loading={busy === 'all'}
                            style={styles.applyAll}
                        />
                    )}
                    {shown.map(g => {
                        const choices = categoriesFor(g.type, available)
                        return (
                            <View key={`${g.type}|${g.key}`} style={styles.row}>
                                <View style={styles.rowTop}>
                                    <View style={{ flex: 1, minWidth: 0 }}>
                                        <Text style={styles.name} numberOfLines={2}>{g.name}</Text>
                                        <Text style={[styles.meta, tabular]}>
                                            {g.count} transaction{g.count === 1 ? '' : 's'} · <Private>{money(g.total)}</Private>
                                        </Text>
                                    </View>
                                    {busy === g.key ? <ActivityIndicator size="small" color={C.primary} /> : (
                                        <View style={styles.actions}>
                                            {g.suggestion && (
                                                <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Use ${g.suggestion} for ${g.name}`} style={styles.suggest}
                                                    onPress={() => apply(g, g.suggestion!)} disabled={!!busy}>
                                                    <Text style={styles.suggestText}>{g.suggestion}</Text>
                                                </TouchableOpacity>
                                            )}
                                            <Button
                                                variant="ghost"
                                                label={g.suggestion ? 'Other' : 'Choose'}
                                                accessibilityLabel={`Choose a category for ${g.name}`}
                                                onPress={() => setChoosing(c => (c === g.key ? null : g.key))}
                                                disabled={!!busy}
                                            />
                                        </View>
                                    )}
                                </View>
                                {choosing === g.key && (
                                    <View style={styles.chips}>
                                        {choices.length === 0 && <Text style={styles.meta}>No {g.type} categories yet. Add some on the Budget tab.</Text>}
                                        {choices.map(c => (
                                            <TouchableOpacity key={c} accessibilityRole="button" accessibilityLabel={`Use ${c} for ${g.name}`} style={styles.chip}
                                                onPress={() => apply(g, c)} disabled={!!busy}>
                                                <Text style={styles.chipText}>{c}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>
                        )
                    })}
                    {groups.length > SHOWN && (
                        <Button
                            variant="ghost"
                            label={showAll ? 'Show fewer' : `Show all ${groups.length} places`}
                            onPress={() => setShowAll(v => !v)}
                            style={{ alignSelf: 'flex-start', marginTop: 8 }}
                        />
                    )}
                </>
            )}
        </Section>
    )
}

const makeStyles = (C: Palette) => StyleSheet.create({
    help: { fontSize: 13, color: C.muted, lineHeight: 18 },
    applyAll: { alignSelf: 'flex-start', marginTop: 10, marginBottom: 6 },
    row: { borderTopWidth: 1, borderColor: C.line, paddingVertical: 10, marginTop: 4 },
    rowTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    name: { fontSize: 14, color: C.ink, fontWeight: '500' },
    meta: { fontSize: 12, color: C.muted, marginTop: 2 },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    suggest: { backgroundColor: C.goodSoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
    suggestText: { color: C.good, fontWeight: '600', fontSize: 13 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
    chip: { borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
    chipText: { fontSize: 13, color: C.text, fontWeight: '500' },
})
