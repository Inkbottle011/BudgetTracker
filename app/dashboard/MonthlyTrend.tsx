import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'

interface Props {
    transactions: any[]
    selectedYear: number
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function MonthlyTrend({ transactions, selectedYear }: Props) {
    const [showAll, setShowAll] = React.useState(false)
    
    const today = new Date()
    const currentMonth = today.getMonth()
    const currentYear = today.getFullYear()
    
    // Last 6 months or all 12
    const monthCount = showAll ? 12 : 6
    const months = Array.from({ length: monthCount }, (_, i) => {
        if (showAll) {
            return { month: i + 1, year: selectedYear, label: MONTHS[i] }
        }
        const d = new Date(today.getFullYear(), today.getMonth() - (monthCount - 1) + i, 1)
        return { month: d.getMonth() + 1, year: d.getFullYear(), label: MONTHS[d.getMonth()] }
    })
    
    const data = months.map(({ month, year, label }) => {
        const inc = transactions
        .filter(t => t.type === 'income' && new Date(t.date).getMonth() + 1 === month && new Date(t.date).getFullYear() === year)
        .reduce((s, t) => s + Number(t.amount), 0)
        const exp = transactions
        .filter(t => t.type === 'expense' && new Date(t.date).getMonth() + 1 === month && new Date(t.date).getFullYear() === year)
        .reduce((s, t) => s + Number(t.amount), 0)
        return { label, income: inc, expense: exp, net: inc - exp }
    })
    
    const max = Math.max(...data.flatMap(d => [d.income, d.expense]), 1)
    
    return (
        <View style={styles.container}>
        <View style={styles.header}>
        <Text style={styles.title}>Monthly Trend</Text>
        <View style={styles.headerRight}>
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
        <TouchableOpacity style={styles.toggleBtn} onPress={() => setShowAll(v => !v)}>
        <Text style={styles.toggleBtnText}>{showAll ? 'Last 6' : 'All 12'}</Text>
        </TouchableOpacity>
        </View>
        </View>
        <View style={styles.chart}>
        {data.map((d, i) => (
            <View key={i} style={styles.monthCol}>
            <View style={styles.bars}>
            <View style={styles.barPair}>
            <View style={[styles.bar, { height: Math.max((d.income / max) * 120, d.income > 0 ? 3 : 0), backgroundColor: '#27ae60' }]} />
            <View style={[styles.bar, { height: Math.max((d.expense / max) * 120, d.expense > 0 ? 3 : 0), backgroundColor: '#e74c3c' }]} />
            </View>
            </View>
            <Text style={styles.monthLabel}>{d.label}</Text>
            <Text style={[styles.monthAmt, { color: d.net >= 0 ? '#27ae60' : '#e74c3c' }]}>
            {d.net >= 0 ? '+' : ''}${Math.round(Math.abs(d.net))}
            </Text>
            </View>
        ))}
        </View>
        </View>
    )
}

import React from 'react'

const styles = StyleSheet.create({
    container: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 0.5, borderColor: '#e0e0e0',height: 245},
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    title: { fontSize: 16, fontWeight: '700', color: '#2c3e50' },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    legend: { flexDirection: 'row', gap: 12 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontSize: 11, color: '#555' },
    toggleBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16, borderWidth: 1, borderColor: '#2980b9' },
    toggleBtnText: { fontSize: 11, color: '#2980b9', fontWeight: '600' },
    chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 160 },
    monthCol: { flex: 1, alignItems: 'center' },
    bars: { height: 120, justifyContent: 'flex-end', width: '100%' },
    barPair: { flexDirection: 'row', gap: 2, alignItems: 'flex-end', justifyContent: 'center' },
    bar: { width: 10, borderRadius: 3 },
    monthLabel: { fontSize: 10, color: '#888', marginTop: 4 },
    monthAmt: { fontSize: 9, fontWeight: '600', marginTop: 2 },
})