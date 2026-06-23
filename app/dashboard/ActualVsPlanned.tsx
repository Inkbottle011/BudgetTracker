import { View, Text, StyleSheet } from 'react-native'
import { SECTION_COLORS } from './useDashboardLogic'

interface Props {
    budgetItems: any[]
    selectedMonth: number
    getPlanned: (itemId: string, month?: number) => number
    getActual: (itemName: string, itemType: string, month?: number) => number
}

export function ActualVsPlanned({ budgetItems, selectedMonth, getPlanned, getActual }: Props) {
    const types = ['income', 'expense', 'savings', 'investment']

    return (
        <>
            {types.map(type => {
                const items = budgetItems.filter(i => i.type === type)
                if (items.length === 0) return null
                const colors = SECTION_COLORS[type]
                const label = type.charAt(0).toUpperCase() + type.slice(1)

                return (
                    <View key={type} style={[styles.avpSection, { borderColor: colors.header }]}>
                        <View style={[styles.avpHeader, { backgroundColor: colors.header }]}>
                            <Text style={styles.avpHeaderText}>{label}</Text>
                            <Text style={styles.avpHeaderCol}>Planned</Text>
                            <Text style={styles.avpHeaderCol}>Actual</Text>
                            <Text style={styles.avpHeaderCol}>Diff</Text>
                        </View>
                        {items.map(item => {
                            const planned = getPlanned(item.id, selectedMonth)
                            const actual = getActual(item.name, item.type, selectedMonth)
                            const diff = planned - actual
                            const pct = planned > 0 ? Math.min(actual / planned, 1) : 0
                            const over = actual > planned && planned > 0
                            return (
                                <View key={item.id} style={[styles.avpRow, { backgroundColor: colors.light }]}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <Text style={[styles.avpName, { color: colors.text }]}>{item.name}</Text>
                                        <View style={{ flexDirection: 'row' }}>
                                            <Text style={styles.avpCol}>${planned.toLocaleString()}</Text>
                                            <Text style={styles.avpCol}>${actual.toLocaleString()}</Text>
                                            <Text style={[styles.avpCol, { color: diff >= 0 ? '#27ae60' : '#e74c3c', fontWeight: '600' }]}>
                                                {diff >= 0 ? '+' : ''}${diff.toLocaleString()}
                                            </Text>
                                        </View>
                                    </View>
                                    {planned > 0 ? (
                                        <View style={styles.progressBar}>
                                            <View style={[styles.progressFill, {
                                                width: `${pct * 100}%`,
                                                backgroundColor: over ? '#e74c3c' : '#27ae60'
                                            }]} />
                                        </View>
                                    ) : null}
                                </View>
                            )
                        })}
                    </View>
                )
            })}
        </>
    )
}

const styles = StyleSheet.create({
    avpSection: { marginBottom: 16, borderRadius: 8, overflow: 'hidden', borderWidth: 1 },
    avpHeader: { flexDirection: 'row', padding: 8, paddingHorizontal: 12 },
    avpHeaderText: { flex: 1, color: '#fff', fontWeight: '700', fontSize: 13 },
    avpHeaderCol: { width: 70, color: '#fff', fontWeight: '600', fontSize: 12, textAlign: 'right' },
    avpRow: { padding: 10, paddingHorizontal: 12, borderTopWidth: 0.5, borderColor: '#ddd' },
    avpName: { fontSize: 13, fontWeight: '500', marginBottom: 4 },
    avpCol: { width: 70, fontSize: 12, textAlign: 'right', color: '#555' },
    progressBar: { height: 4, backgroundColor: '#e0e0e0', borderRadius: 2, marginTop: 6, overflow: 'hidden' },
    progressFill: { height: 4, borderRadius: 2 },
})