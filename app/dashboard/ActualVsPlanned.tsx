import { View, Text, StyleSheet, ScrollView } from 'react-native'
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
        <View>
        {types.map(type => {
            const items = budgetItems.filter(i => i.type === type)
            if (items.length === 0) return null
            const colors = SECTION_COLORS[type]
            const label = type.charAt(0).toUpperCase() + type.slice(1)
            
            return (
                <View key={type} style={styles.section}>
                {/* Section label */}
                <View style={[styles.sectionHeader, { backgroundColor: colors.header }]}>
                <Text style={styles.sectionLabel}>{label}</Text>
                </View>
                
                {/* Items */}
                {items.map(item => {
                    const planned = getPlanned(item.id, selectedMonth)
                    const actual = getActual(item.name, item.type, selectedMonth)
                    const diff = planned - actual
                    const pct = planned > 0 ? Math.min(actual / planned, 1) : 0
                    const over = actual > planned && planned > 0
                    
                    return (
                        <View key={item.id} style={[styles.row, { backgroundColor: colors.light }]}>
                        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                        <View style={styles.barRow}>
                        <View style={styles.barTrack}>
                        <View style={[styles.barFill, {
                            width: `${pct * 100}%`,
                            backgroundColor: over ? '#e74c3c' : colors.header
                        }]} />
                        </View>
                        <Text style={[styles.diff, { color: diff >= 0 ? '#27ae60' : '#e74c3c' }]}>
                        {diff >= 0 ? '+' : ''}${Math.abs(diff).toLocaleString()}
                        </Text>
                        </View>
                        <View style={styles.amountRow}>
                        <Text style={styles.amountLabel}>Plan <Text style={styles.amountVal}>${planned.toLocaleString()}</Text></Text>
                        <Text style={styles.amountLabel}>Act <Text style={styles.amountVal}>${actual.toLocaleString()}</Text></Text>
                        </View>
                        </View>
                    )
                })}
                </View>
            )
        })}
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    section: { marginBottom: 8, borderRadius: 8, overflow: 'hidden', borderWidth: 0.5, borderColor: '#ddd' },
    sectionHeader: { paddingHorizontal: 8, paddingVertical: 4 },
    sectionLabel: { color: '#fff', fontWeight: '700', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3 },
    row: { padding: 8, borderTopWidth: 0.5, borderColor: '#ddd' },
    name: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
    barRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
    barTrack: { flex: 1, height: 6, backgroundColor: '#e0e0e0', borderRadius: 3, overflow: 'hidden' },
    barFill: { height: 6, borderRadius: 3 },
    diff: { fontSize: 10, fontWeight: '700', minWidth: 40, textAlign: 'right' },
    amountRow: { flexDirection: 'row', gap: 10 },
    amountLabel: { fontSize: 10, color: '#aaa' },
    amountVal: { fontSize: 10, color: '#555', fontWeight: '600' },
})