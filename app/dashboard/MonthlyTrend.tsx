import { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native'
import { monthlyTrend, trendMonths } from './calculations'

interface Props {
    transactions: any[]
    selectedYear: number
}

export function MonthlyTrend({ transactions, selectedYear }: Props) {
    const [showAll, setShowAll] = useState(false)
    const [active, setActive] = useState<number | null>(null)   // index of the hovered or tapped month
    const months = trendMonths(new Date(), showAll, selectedYear)
    const data = monthlyTrend(transactions, months)
    const picked = active !== null && active < data.length ? { ...data[active], year: months[active].year } : null
    
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
        <TouchableOpacity style={styles.toggleBtn} onPress={() => { setShowAll(v => !v); setActive(null) }}>
        <Text style={styles.toggleBtnText}>{showAll ? 'Last 6' : 'All 12'}</Text>
        </TouchableOpacity>
        </View>
        </View>
        {/* The hovered (or tapped) month's numbers; the space is kept so the chart doesn't jump */}
        <View style={styles.detail}>
        {picked ? (
            <>
            <Text style={styles.detailTitle}>{picked.label} {picked.year}</Text>
            <Text style={[styles.detailText, { color: '#27ae60' }]}>Income {money(picked.income)}</Text>
            <Text style={[styles.detailText, { color: '#e74c3c' }]}>Spent {money(picked.expense)}</Text>
            <Text style={[styles.detailText, { color: picked.net >= 0 ? '#27ae60' : '#e74c3c' }]}>
            Net {picked.net >= 0 ? '+' : '-'}{money(Math.abs(picked.net))}
            </Text>
            </>
        ) : (
            <Text style={styles.detailHint}>Hover over or tap a month to see its numbers</Text>
        )}
        </View>
        <View style={styles.chart}>
        {data.map((d, i) => (
            <Pressable
            key={i}
            accessibilityLabel={d.label}
            onHoverIn={() => setActive(i)}
            onHoverOut={() => setActive(a => (a === i ? null : a))}
            onPress={() => setActive(a => (a === i ? null : i))}
            style={[styles.monthCol, active === i && styles.monthActive, active !== null && active !== i && styles.monthDim]}
            >
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
            </Pressable>
        ))}
        </View>
        </View>
    )
}

import React from 'react'

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const styles = StyleSheet.create({
    container: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 0.5, borderColor: '#e0e0e0' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    title: { fontSize: 16, fontWeight: '700', color: '#2c3e50' },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    legend: { flexDirection: 'row', gap: 12 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontSize: 11, color: '#555' },
    toggleBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16, borderWidth: 1, borderColor: '#2980b9' },
    toggleBtnText: { fontSize: 11, color: '#2980b9', fontWeight: '600' },
    chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 160 },
    monthCol: { flex: 1, alignItems: 'center', borderRadius: 8, paddingBottom: 4 },
    monthActive: { backgroundColor: '#eef4fb' },
    monthDim: { opacity: 0.45 },
    detail: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, minHeight: 22, marginBottom: 8 },
    detailTitle: { fontSize: 13, fontWeight: '700', color: '#2c3e50' },
    detailText: { fontSize: 12, fontWeight: '600' },
    detailHint: { fontSize: 11, color: '#aaa' },
    bars: { height: 120, justifyContent: 'flex-end', width: '100%' },
    barPair: { flexDirection: 'row', gap: 2, alignItems: 'flex-end', justifyContent: 'center' },
    bar: { width: 10, borderRadius: 3 },
    monthLabel: { fontSize: 10, color: '#888', marginTop: 4 },
    monthAmt: { fontSize: 9, fontWeight: '600', marginTop: 2 },
})