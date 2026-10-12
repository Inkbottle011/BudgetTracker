import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { BudgetRow } from './summary'
import { C, tabular, money } from './theme'

interface Props {
    title: string
    rows: BudgetRow[]
    uncategorized: number
    goals: { name: string; type: string; planned: number; actual: number }[]
    onCategorize: () => void
    onEditBudget: () => void
}

/** Every spending category against its plan, then income and savings goals. */
export function BudgetList({ title, rows, uncategorized, goals, onCategorize, onEditBudget }: Props) {
    const visible = rows.filter(r => r.planned > 0 || r.spent > 0)
    return (
        <View style={styles.section}>
            <View style={styles.head}>
                <Text style={styles.title}>{title}</Text>
                <TouchableOpacity onPress={onEditBudget}><Text style={styles.link}>Edit budget</Text></TouchableOpacity>
            </View>

            {visible.length === 0 && uncategorized === 0 && (
                <Text style={styles.empty}>No spending yet. Add categories on the Budget tab to plan how much to spend on each.</Text>
            )}

            {visible.map(r => {
                const over = r.planned > 0 && r.spent > r.planned
                const share = r.planned > 0 ? Math.min(1, r.spent / r.planned) : 1
                return (
                    <View key={r.name} style={styles.row}>
                        <View style={styles.rowTop}>
                            <Text style={styles.name} numberOfLines={1}>{r.name}</Text>
                            <Text style={[styles.status, tabular, over && { color: C.bad }, r.planned > 0 && !over && { color: C.good }]}>
                                {r.planned === 0 ? 'No budget' : over ? `${money(r.spent - r.planned)} over` : `${money(r.left)} left`}
                            </Text>
                        </View>
                        <View style={styles.track}>
                            <View style={[styles.fill, { width: `${share * 100}%` }, over && styles.fillOver, r.planned === 0 && styles.fillUnplanned]} />
                        </View>
                        <Text style={[styles.detail, tabular]}>{r.planned > 0 ? `${money(r.spent)} of ${money(r.planned)}` : `${money(r.spent)} spent`}</Text>
                    </View>
                )
            })}

            {uncategorized > 0 && (
                <View style={[styles.row, styles.uncat]}>
                    <View style={styles.rowTop}>
                        <Text style={styles.name}>Uncategorized</Text>
                        <Text style={[styles.status, tabular, { color: C.ink }]}>{money(uncategorized)}</Text>
                    </View>
                    <TouchableOpacity onPress={onCategorize}>
                        <Text style={styles.link}>Give these a category</Text>
                    </TouchableOpacity>
                </View>
            )}

            {goals.length > 0 && (
                <>
                    <Text style={styles.subTitle}>Income and savings</Text>
                    {goals.map(g => {
                        const share = g.planned > 0 ? Math.min(1, g.actual / g.planned) : 0
                        const reached = g.planned > 0 && g.actual >= g.planned
                        return (
                            <View key={`${g.type}-${g.name}`} style={styles.row}>
                                <View style={styles.rowTop}>
                                    <Text style={styles.name} numberOfLines={1}>{g.name}</Text>
                                    <Text style={[styles.status, tabular, reached && { color: C.good }]}>
                                        {g.planned === 0 ? money(g.actual) : reached ? 'Reached' : `${money(g.planned - g.actual)} to go`}
                                    </Text>
                                </View>
                                {g.planned > 0 && (
                                    <View style={styles.track}>
                                        <View style={[styles.fill, styles.fillGoal, { width: `${share * 100}%` }]} />
                                    </View>
                                )}
                                {g.planned > 0 && <Text style={[styles.detail, tabular]}>{money(g.actual)} of {money(g.planned)}</Text>}
                            </View>
                        )
                    })}
                </>
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    section: { backgroundColor: C.surface, borderRadius: 14, padding: 20, marginBottom: 16 },
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 },
    title: { fontSize: 18, fontWeight: '700', color: C.ink },
    subTitle: { fontSize: 15, fontWeight: '700', color: C.ink, marginTop: 20, marginBottom: 2 },
    link: { fontSize: 13, color: C.plan, fontWeight: '600' },
    empty: { fontSize: 14, color: C.muted, lineHeight: 20, marginVertical: 8 },
    row: { paddingVertical: 10 },
    rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
    name: { fontSize: 15, color: C.ink, fontWeight: '500', flexShrink: 1 },
    status: { fontSize: 14, fontWeight: '600', color: C.muted },
    track: { height: 6, backgroundColor: C.track, borderRadius: 3, marginTop: 7, overflow: 'hidden' },
    fill: { height: 6, backgroundColor: C.ink, borderRadius: 3 },
    fillOver: { backgroundColor: C.bad },
    fillUnplanned: { backgroundColor: C.faint },
    fillGoal: { backgroundColor: C.plan },
    detail: { fontSize: 12, color: C.muted, marginTop: 5 },
    uncat: { borderTopWidth: 1, borderColor: C.line, marginTop: 6, paddingTop: 14 },
})
