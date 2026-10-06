import { useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { supabase } from '../../lib/supabase'
import { buildCategoryGuesser } from '../../lib/entry'
import { groupUncategorized, categoriesFor, UncategorizedGroup } from '../../lib/categorize'
import { DEFAULT_CATEGORIES } from './types'
import { useToastContext } from '../../context/ToastContext'

interface Props {
    transactions: any[]
    /** Your budget categories by type ('Expense': [...], ...) */
    budgetCategories: Record<string, string[]>
    onChanged: () => void
}

const SHOWN = 15
const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const TYPES = ['income', 'expense', 'savings', 'investment']

/**
 * Transactions without a category, grouped by place, so a whole place is categorized at once.
 * What you pick is learned: future imports from the same place get the same category.
 */
export function UncategorizedPanel({ transactions, budgetCategories, onChanged }: Props) {
    const { showToast } = useToastContext()
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

    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <Text style={styles.title}>
                    {count} transaction{count === 1 ? '' : 's'} without a category ({groups.length} place{groups.length === 1 ? '' : 's'})
                </Text>
                <TouchableOpacity onPress={() => setOpen(o => !o)}>
                    <Text style={styles.link}>{open ? 'Hide' : 'Review'}</Text>
                </TouchableOpacity>
            </View>

            {open && (
                <>
                    <Text style={styles.help}>Pick a category once per place; future transactions from it are categorized automatically.</Text>
                    {suggested.length > 0 && (
                        <TouchableOpacity style={styles.primary} onPress={applyAll} disabled={!!busy}>
                            {busy === 'all' ? <ActivityIndicator color="#fff" size="small" />
                                : <Text style={styles.primaryText}>Apply all {suggested.length} suggestion{suggested.length === 1 ? '' : 's'}</Text>}
                        </TouchableOpacity>
                    )}
                    {shown.map(g => {
                        const choices = categoriesFor(g.type, available)
                        return (
                            <View key={`${g.type}|${g.key}`} style={styles.row}>
                                <View style={styles.rowTop}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.name} numberOfLines={1}>{g.name}</Text>
                                        <Text style={styles.meta}>{g.count} × · {money(g.total)}</Text>
                                    </View>
                                    {busy === g.key ? <ActivityIndicator size="small" /> : (
                                        <View style={styles.actions}>
                                            {g.suggestion && (
                                                <TouchableOpacity accessibilityLabel={`Use ${g.suggestion} for ${g.name}`} style={styles.suggest}
                                                    onPress={() => apply(g, g.suggestion!)} disabled={!!busy}>
                                                    <Text style={styles.suggestText}>{g.suggestion}</Text>
                                                </TouchableOpacity>
                                            )}
                                            <TouchableOpacity accessibilityLabel={`Choose a category for ${g.name}`}
                                                onPress={() => setChoosing(c => (c === g.key ? null : g.key))} disabled={!!busy}>
                                                <Text style={styles.link}>{g.suggestion ? 'Other…' : 'Choose…'}</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                                {choosing === g.key && (
                                    <View style={styles.chips}>
                                        {choices.length === 0 && <Text style={styles.meta}>No {g.type} categories yet. Add some on the Budget tab.</Text>}
                                        {choices.map(c => (
                                            <TouchableOpacity key={c} accessibilityLabel={`Use ${c} for ${g.name}`} style={styles.chip}
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
                        <TouchableOpacity onPress={() => setShowAll(v => !v)}>
                            <Text style={[styles.link, { marginTop: 8 }]}>{showAll ? 'Show fewer' : `Show all ${groups.length} places`}</Text>
                        </TouchableOpacity>
                    )}
                </>
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, margin: 16, marginBottom: 0, borderWidth: 0.5, borderColor: '#e0e0e0', gap: 6 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
    title: { fontSize: 14, fontWeight: '700', color: '#2c3e50', flex: 1 },
    help: { fontSize: 12, color: '#888' },
    link: { color: '#3498db', fontWeight: '600', fontSize: 13 },
    primary: { backgroundColor: '#2c3e50', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'flex-start', marginVertical: 4 },
    primaryText: { color: '#fff', fontWeight: '600', fontSize: 13 },
    row: { borderTopWidth: 0.5, borderColor: '#eee', paddingVertical: 8 },
    rowTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    name: { fontSize: 14, color: '#1a1a1a', fontWeight: '500' },
    meta: { fontSize: 12, color: '#888', marginTop: 2 },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    suggest: { backgroundColor: '#eafaf1', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
    suggestText: { color: '#1e8449', fontWeight: '600', fontSize: 12 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
    chip: { borderWidth: 1, borderColor: '#d5dbe1', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
    chipText: { fontSize: 12, color: '#2c3e50' },
})
