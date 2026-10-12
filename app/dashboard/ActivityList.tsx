import { View, Text, StyleSheet } from 'react-native'
import { shortDate } from '../../lib/bank'
import { activityDirection } from './summary'
import { C, tabular, money } from './theme'

interface Item { id: string; name?: string | null; category_label?: string | null; date: string; type: string; amount: number | string; sub?: string }

/** A short list of transactions: upcoming bills or recent activity. */
export function ActivityList({ title, items, empty }: { title: string; items: Item[]; empty: string }) {
    return (
        <View style={styles.section}>
            <Text style={styles.title}>{title}</Text>
            {items.length === 0 && <Text style={styles.empty}>{empty}</Text>}
            {items.map((t, i) => {
                const dir = activityDirection(t.type)
                const amount = Math.abs(Number(t.amount))
                return (
                    <View key={`${t.id}-${t.date}-${i}`} style={[styles.row, i > 0 && styles.rowLine]}>
                        <Text style={[styles.date, tabular]}>{shortDate(t.date)}</Text>
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.name} numberOfLines={1}>{t.name || t.category_label || 'Transaction'}</Text>
                            {(t.sub || dir === 'move') && <Text style={styles.sub}>{t.sub ?? 'Transfer between your accounts'}</Text>}
                        </View>
                        <Text style={[styles.amount, tabular, dir === 'in' && { color: C.good }, dir === 'move' && { color: C.move }]}>
                            {dir === 'in' ? '+' : dir === 'out' ? '-' : ''}{money(amount)}
                        </Text>
                    </View>
                )
            })}
        </View>
    )
}

const styles = StyleSheet.create({
    section: { backgroundColor: C.surface, borderRadius: 14, padding: 20, marginBottom: 16 },
    title: { fontSize: 18, fontWeight: '700', color: C.ink, marginBottom: 6 },
    empty: { fontSize: 14, color: C.muted, marginTop: 4 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
    rowLine: { borderTopWidth: 1, borderColor: C.line },
    date: { width: 46, fontSize: 12, color: C.muted },
    name: { fontSize: 14, color: C.ink },
    sub: { fontSize: 12, color: C.faint, marginTop: 1 },
    amount: { fontSize: 14, fontWeight: '600', color: C.ink },
})
