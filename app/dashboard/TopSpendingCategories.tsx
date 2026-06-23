import { View, Text, StyleSheet } from 'react-native'

interface Props {
    data: { label: string; amount: number }[]
}

const COLORS = ['#e74c3c', '#2980b9', '#27ae60', '#8e44ad', '#e67e22']

export function TopSpendingCategories({ data }: Props) {
    if (data.length === 0) {
        return null
    }
    
    const top5 = data.slice(0, 5)
    const total = top5.reduce((s, d) => s + d.amount, 0)
    
    return (
        <View style={styles.container}>
        <Text style={styles.title}>Top Spending Categories</Text>
        {top5.map((d, i) => {
            const pct = total > 0 ? (d.amount / total) * 100 : 0
            return (
                <View key={d.label} style={styles.row}>
                <View style={styles.rank}>
                <Text style={styles.rankText}>{i + 1}</Text>
                </View>
                <Text style={styles.label} numberOfLines={1}>{d.label}</Text>
                <View style={styles.barTrack}>
                <View style={[styles.barFill, {
                    width: `${pct}%`,
                    backgroundColor: COLORS[i % COLORS.length]
                }]} />
                </View>
                <Text style={styles.amount}>${d.amount.toLocaleString()}</Text>
                </View>
            )
        })}
        </View>
    )
}

const styles = StyleSheet.create({
    container: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 0.5, borderColor: '#e0e0e0' },
    title: { fontSize: 16, fontWeight: '700', color: '#2c3e50', marginBottom: 12 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    rank: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
    rankText: { fontSize: 11, fontWeight: '700', color: '#555' },
    label: { width: 90, fontSize: 12, color: '#555' },
    barTrack: { flex: 1, height: 16, backgroundColor: '#f0f0f0', borderRadius: 4, overflow: 'hidden' },
    barFill: { height: 16, borderRadius: 4 },
    amount: { width: 70, fontSize: 12, fontWeight: '600', color: '#2c3e50', textAlign: 'right' },
})