// Splitting one spending category into two (Food -> Groceries and Eating out): past purchases are
// sorted a place at a time, the budget is shared between the two, and new purchases follow.
import { useEffect, useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet } from 'react-native'
import { useTheme, useStyles, Palette, tabular } from '../../../shared/theme/theme'
import { Button, Field, useIsWide } from '../../../shared/ui/ui'
import { formatMoney } from '../../../shared/money/format'
import { parseAmount, keywordCategory } from '../../../shared/money/entry'
import { useTransactionStore, loadAllTransactions, groupForSplit, recategorize } from '../../transactions/api'
import { moveSubscriptionsOutOf } from '../../subscriptions/api'
import { splitBudgetItem } from '../logic/data'
import { BudgetItem } from '../logic/types'

const dollars = (n: number) => formatMoney(n, { cents: false })

/** Good starting names for a few common splits. */
function suggestedNames(name: string): [string, string] {
    if (/food|dining|meals?/i.test(name)) return ['Groceries', 'Eating out']
    if (/transport|travel|car/i.test(name)) return ['Gas', 'Public transport']
    if (/rent.*util|bills/i.test(name)) return ['Rent', 'Utilities']
    return ['', '']
}

export function SplitCategory({ item, items, monthly, onClose, onDone }: {
    item: BudgetItem
    items: BudgetItem[]
    /** What the item is planned at per month now */
    monthly: number
    onClose: () => void
    onDone: (names: [string, string]) => void
}) {
    const wide = useIsWide()
    const { c: C } = useTheme()
    const s = useStyles(makeStyles)
    const [names, setNames] = useState<[string, string]>(() => suggestedNames(item.name))
    const [picked, setPicked] = useState<Record<string, 0 | 1>>({})
    const [firstText, setFirstText] = useState<string | null>(null)   // null until you type your own
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const stored = useTransactionStore(st => st.transactions)
    const [loaded, setLoaded] = useState<any[] | null>(null)
    useEffect(() => {
        let live = true
        if (!stored.length) loadAllTransactions().then(t => { if (live && t) setLoaded(t) }).catch(() => {})
        return () => { live = false }
    }, [])
    const transactions = (stored.length ? stored : loaded ?? []) as any[]

    const label = (i: 0 | 1) => names[i].trim() || (i === 0 ? 'First part' : 'Second part')
    // Places we couldn't tell go first, so they get checked
    const groups = useMemo(() => {
        const all = groupForSplit(transactions, item.name, [label(0), label(1)])
        return [...all.filter(g => !g.suggestion), ...all.filter(g => g.suggestion)]
    }, [transactions, item.name, names])
    const sideOf = (g: (typeof groups)[number]): 0 | 1 =>
        picked[g.key] ?? (g.suggestion && g.suggestion.toLowerCase() === label(0).toLowerCase() ? 0 : 1)

    // Share the budget by what you really spend in each part
    const spent = [0, 0]
    for (const g of groups) spent[sideOf(g)] += Math.max(0, g.spent)
    const shareBySpending = spent[0] + spent[1] > 0 ? spent[0] / (spent[0] + spent[1]) : 0.5
    const firstAmount = firstText === null ? Math.round(monthly * shareBySpending) : Math.abs(parseAmount(firstText) ?? 0)
    const rest = Math.max(0, monthly - firstAmount)
    const share = monthly > 0 ? Math.min(1, firstAmount / monthly) : shareBySpending

    const same = names[0].trim().toLowerCase() === names[1].trim().toLowerCase()
    const problem = !names[0].trim() || !names[1].trim() ? 'Name both parts.' : same ? 'Give the two parts different names.' : null
    const unsure = groups.filter(g => !g.suggestion && picked[g.key] === undefined)

    async function save() {
        setSaving(true)
        setError(null)
        const into: [string, string] = [names[0].trim(), names[1].trim()]
        try {
            const ids: [string[], string[]] = [[], []]
            for (const g of groups) ids[sideOf(g)].push(...g.ids)
            await recategorize([{ category: into[0], ids: ids[0] }, { category: into[1], ids: ids[1] }].filter(c => c.ids.length))
            await moveSubscriptionsOutOf(item.name, name => keywordCategory(name, into) ?? into[1])
            await splitBudgetItem({ item, into, share, existing: items })
            onDone(into)
        } catch (e: any) {
            setError(e?.message ?? `Couldn't split ${item.name}`)
            setSaving(false)
        }
    }

    return (
        <Modal visible transparent animationType={wide ? 'fade' : 'slide'} onRequestClose={onClose}>
            <View style={[s.overlay, !wide && s.overlayPhone]}>
                <View style={[s.modal, !wide && s.modalPhone]}>
                    <View style={s.header}>
                        <Text style={s.title} accessibilityRole="header">Split {item.name} into two</Text>
                    </View>
                    <ScrollView style={s.body} contentContainerStyle={s.bodyContent} keyboardShouldPersistTaps="handled">
                        <View style={s.pair}>
                            <View style={s.half}><Field label="First new category" value={names[0]} onChangeText={v => setNames([v, names[1]])} placeholder="e.g. Groceries" /></View>
                            <View style={s.half}><Field label="Second new category" value={names[1]} onChangeText={v => setNames([names[0], v])} placeholder="e.g. Eating out" /></View>
                        </View>
                        {problem && <Text style={[s.warn, { color: C.bad }]}>{problem}</Text>}

                        <Text style={s.heading}>Your past purchases</Text>
                        <Text style={s.help}>
                            {groups.length
                                ? `We've sorted them by place. Tap to move a place to the other one.${unsure.length ? ` The ${unsure.length} we couldn't tell are at the top.` : ''}`
                                : `Nothing is in ${item.name} yet, so there's nothing to sort.`}
                        </Text>
                        {groups.map(g => {
                            const side = sideOf(g)
                            return (
                                <View key={g.key} style={s.place}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.placeName} numberOfLines={1}>{g.name}</Text>
                                        <Text style={[s.placeMeta, tabular]}>{g.count} {g.count === 1 ? 'purchase' : 'purchases'} · {formatMoney(g.spent)}</Text>
                                        {!g.suggestion && picked[g.key] === undefined && <Text style={[s.unsure, { color: C.warn }]}>Not sure, check this one</Text>}
                                    </View>
                                    <View style={s.sides}>
                                        {([0, 1] as const).map(i => (
                                            <TouchableOpacity key={i} accessibilityRole="button" accessibilityLabel={`${g.name}: ${label(i)}`} accessibilityState={{ selected: side === i }}
                                                onPress={() => setPicked(p => ({ ...p, [g.key]: i }))} style={[s.side, side === i && s.sideOn]}>
                                                <Text style={[s.sideText, side === i && s.sideTextOn]} numberOfLines={1}>{label(i)}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            )
                        })}

                        {monthly > 0 && (
                            <>
                                <Text style={s.heading}>Your budget</Text>
                                <Text style={s.help}>{item.name} is {dollars(monthly)} a month. We've shared it by what you spend in each; change it if you like.</Text>
                                <Field
                                    label={`${label(0)} per month`} keyboardType="decimal-pad"
                                    value={firstText ?? String(firstAmount)} onChangeText={setFirstText}
                                    hint={`${label(1)} gets the other ${dollars(rest)} a month`}
                                />
                                {firstAmount > monthly && <Text style={[s.warn, { color: C.bad }]}>That's more than {item.name}'s {dollars(monthly)}; {label(0)} will get all of it.</Text>}
                            </>
                        )}
                        <Text style={s.help}>From now on, new purchases go to {label(0)} or {label(1)} based on the place.</Text>
                        {error && <Text style={[s.warn, { color: C.bad }]}>{error}</Text>}
                    </ScrollView>
                    <View style={s.footer}>
                        <Button variant="secondary" label="Cancel" onPress={onClose} />
                        <Button label={`Split ${item.name}`} onPress={save} loading={saving} disabled={!!problem} />
                    </View>
                </View>
            </View>
        </Modal>
    )
}

const makeStyles = (C: Palette) => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: C.scrim, justifyContent: 'center', alignItems: 'center', padding: 16 },
    overlayPhone: { padding: 0, justifyContent: 'flex-end' },
    modal: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.line, width: '100%', maxWidth: 600, maxHeight: '92%' },
    modalPhone: { flex: 1, maxHeight: '100%', borderRadius: 0, borderWidth: 0 },
    header: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderColor: C.line },
    title: { fontSize: 20, fontWeight: '700', color: C.ink },
    body: { flexGrow: 0, flexShrink: 1 },
    bodyContent: { padding: 20 },
    footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderColor: C.line },
    pair: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    half: { flex: 1, minWidth: 150 },
    heading: { fontSize: 16, fontWeight: '700', color: C.ink, marginTop: 10, marginBottom: 4 },
    help: { fontSize: 13, color: C.muted, lineHeight: 18, marginBottom: 10 },
    warn: { fontSize: 13, fontWeight: '600', marginBottom: 10 },
    place: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderColor: C.line },
    placeName: { fontSize: 15, fontWeight: '600', color: C.ink },
    placeMeta: { fontSize: 12, color: C.muted, marginTop: 1 },
    unsure: { fontSize: 12, fontWeight: '600', marginTop: 2 },
    sides: { flexDirection: 'row', backgroundColor: C.track, borderRadius: 10, padding: 3, maxWidth: '58%' },
    side: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, flexShrink: 1 },
    sideOn: { backgroundColor: C.primary },
    sideText: { fontSize: 13, fontWeight: '600', color: C.muted },
    sideTextOn: { color: C.onPrimary },
})
