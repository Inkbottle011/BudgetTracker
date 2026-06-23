import { View, Text, StyleSheet } from 'react-native'

interface Props {
    transactions: any[]
    selectedYear: number
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function MonthlyTrend({ transactions, selectedYear }: Props) {
    // Get last 6 months
    const today = new Date()
    const months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(today.getFullYear(), today.getMonth() - 5 + i, 1)
        return { month: d.getMonth() + 1, year: d.getFullYear(), label: MONTHS[d.getMonth()] }
    })

    const data = months.map(({ month, year, label }) => {
        const inc = transactions
            .filter(t => t.type === 'income' && new Date(t.date).getMonth() + 1 === month && new Date(t.date).getFullYear() === year)
            .reduce((s, t) => s + Number(t.amount), 0)
        const exp = transactions
            .filter(t => t.type === 'expense' && new Date(t.date).getMonth() + 1 === month && new Date(t.date).getFullYear() === year)
            .reduce((s, t) => s + Number(t.amount), 0)
        return { label, income: inc, expense: exp }
    })

    const max = Math.max(...data.flatMap(d => [d.income, d.expense]), 1)

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Monthly Trend (Last 6 Months)</Text>
            <View style={styles.legend}>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#27ae60' }]} />
                    <Text style={styles.legendText}>Income</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#e74c3c' }]} />
                    <Text style={styles.legendText}>Expenses</Text>
                </View>
            </View>
            <View style={styles.chart}>
                {data.map((d, i) => (
                    <View key={i} style={styles.monthCol}>
                        <View style={styles.bars}>
                            <View style={styles.barPair}>
                                <View style={[styles.bar, { height: Math.max((d.income / max) * 120, 2), backgroundColor: '#27ae60' }]} />
                                <View style={[styles.bar, { height: Math.max((d.expense / max) * 120, 2), backgroundColor: '#e74c3c' }]} />
                            </View>
                        </View>
                        <Text style={styles.monthLabel}>{d.label}</Text>
                        <Text style={styles.monthAmt}>${Math.round(d.income - d.expense) >= 0 ? '+' : ''}{Math.round(d.income - d.expense)}</Text>
                    </View>
                ))}
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 0.5, borderColor: '#e0e0e0' },
    title: { fontSize: 16, fontWeight: '700', color: '#2c3e50', marginBottom: 12 },
    legend: { flexDirection: 'row', gap: 16, marginBottom: 12 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    legendText: { fontSize: 12, color: '#555' },
    chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 160 },
    monthCol: { flex: 1, alignItems: 'center' },
    bars: { height: 120, justifyContent: 'flex-end', width: '100%' },
    barPair: { flexDirection: 'row', gap: 2, alignItems: 'flex-end', justifyContent: 'center' },
    bar: { width: 12, borderRadius: 3 },
    monthLabel: { fontSize: 11, color: '#888', marginTop: 4 },
    monthAmt: { fontSize: 10, color: '#555', fontWeight: '600' },
})