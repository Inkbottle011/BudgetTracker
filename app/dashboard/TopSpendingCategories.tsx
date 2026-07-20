import { View, Text, StyleSheet } from 'react-native'

interface SpendingData {
    label: string
    amount: number
}

interface Props {
    data: SpendingData[]
    budgetItems: any[]
    getPlanned: (itemId: string) => number
}

const BAR_MAX_HEIGHT = 120

export function TopSpendingCategories({ data, budgetItems, getPlanned }: Props) {
    if (!budgetItems || !data) return null
    
    const overspend = data
    .map(d => {
        const item = budgetItems.find(i => i.name === d.label && i.type === 'expense')
        const planned = item ? getPlanned(item.id) : 0
        const overDollars = planned > 0 ? d.amount - planned : 0
        const overPct = planned > 0 ? ((d.amount - planned) / planned) * 100 : 0
        return { label: d.label, actual: d.amount, planned, overDollars, overPct }
    })
    .filter(d => d.overDollars > 0)
    .sort((a, b) => b.overDollars - a.overDollars)
    .slice(0, 5)
    
    if (overspend.length === 0) {
        return (
            <View style={styles.container}>
            <Text style={styles.title}>Top Overspending</Text>
            <Text style={styles.empty}>No overspending this period 🎉</Text>
            </View>
        )
    }
    
    const maxActual = Math.max(...overspend.map(d => d.actual))
    
    return (
        <View style={styles.container}>
        <Text style={styles.title}>Top Overspending</Text>
        
        {/* Vertical bars */}
        <View style={styles.barsContainer}>
        {overspend.map((d, i) => {
            const totalHeight = (d.actual / maxActual) * BAR_MAX_HEIGHT
            const plannedHeight = Math.min((d.planned / d.actual) * totalHeight, totalHeight)
            const overHeight = totalHeight - plannedHeight
            
            return (
                <View key={d.label} style={styles.barCol}>
                <Text style={styles.overLabel}>+${Math.round(d.overDollars)}</Text>
                <Text style={styles.overPct}>{Math.round(d.overPct)}%</Text>
                <View style={[styles.barTrack, { height: BAR_MAX_HEIGHT }]}>
                <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                <View style={[styles.barOver, { height: overHeight }]} />
                <View style={[styles.barPlanned, { height: plannedHeight }]} />
                </View>
                </View>
                <Text style={styles.barLabel} numberOfLines={2}>{d.label}</Text>
                <Text style={styles.barActual}>${Math.round(d.actual)}</Text>
                </View>
            )
        })}
        </View>
        
        {/* Legend */}
        <View style={styles.legend}>
        <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: '#27ae60' }]} />
        <Text style={styles.legendText}>Budget</Text>
        </View>
        <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: '#e74c3c' }]} />
        <Text style={styles.legendText}>Over</Text>
        </View>
        </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 0.5, borderColor: '#e0e0e0'},
    title: { fontSize: 16, fontWeight: '700', color: '#2c3e50', marginBottom: 16 },
    empty: { textAlign: 'center', color: '#27ae60', fontSize: 14, paddingVertical: 24, fontWeight: '500' },
    barsContainer: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', marginBottom: 12 },
    barCol: { flex: 1, alignItems: 'center', gap: 4 },
    overLabel: { fontSize: 10, fontWeight: '700', color: '#e74c3c', textAlign: 'center' },
    overPct: { fontSize: 9, color: '#e74c3c', backgroundColor: '#fdedec', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 8, textAlign: 'center' },
    barTrack: { width: 28, backgroundColor: '#f0f0f0', borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end' },
    barPlanned: { width: 28, backgroundColor: '#27ae60' },
    barOver: { width: 28, backgroundColor: '#e74c3c' },
    barLabel: { fontSize: 10, color: '#555', textAlign: 'center', marginTop: 4 },
    barActual: { fontSize: 10, fontWeight: '600', color: '#2c3e50', textAlign: 'center' },
    legend: { flexDirection: 'row', gap: 16, justifyContent: 'center', borderTopWidth: 0.5, borderColor: '#f0f0f0', paddingTop: 10 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontSize: 11, color: '#555' },
})