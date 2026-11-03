import { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native'
import { monthlyTrend, trendMonths } from '../logic/calculations'
import { useTheme, useStyles, Palette } from '../../../shared/theme/theme'

interface Props {
    transactions: any[]
    selectedYear: number
}

export function MonthlyTrend({ transactions, selectedYear }: Props) {
    const { c: C } = useTheme()
    const styles = useStyles(makeStyles)
    const [showAll, setShowAll] = useState(false)
    const [active, setActive] = useState<number | null>(null)   // index of the hovered or tapped month
    const months = trendMonths(new Date(), showAll, selectedYear)
    const data = monthlyTrend(transactions, months)
    const picked = active !== null && active < data.length ? { ...data[active], year: months[active].year } : null
    
    const max = Math.max(...data.flatMap(d => [d.income, d.expense]), 1)
    
    return (
        <View style={styles.container}>
        <View style={styles.header}>
        <Text style={styles.title}>Monthly trend</Text>
        <View style={styles.headerRight}>
        <View style={styles.legend}>
        <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: C.incomeMark }]} />
        <Text style={styles.legendText}>Income</Text>
        </View>
        <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: C.spendMark }]} />
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
            <Text style={[styles.detailText, { color: C.good }]}>Income <Private kind="totals">{money(picked.income)}</Private></Text>
            <Text style={[styles.detailText, { color: C.bad }]}>Spent <Private kind="totals">{money(picked.expense)}</Private></Text>
            <Text style={[styles.detailText, { color: picked.net >= 0 ? C.good : C.bad }]}>
            Net <Private kind="totals">{picked.net >= 0 ? '+' : '-'}{money(Math.abs(picked.net))}</Private>
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
            <View style={[styles.bar, { height: Math.max((d.income / max) * 120, d.income > 0 ? 3 : 0), backgroundColor: C.incomeMark }]} />
            <View style={[styles.bar, { height: Math.max((d.expense / max) * 120, d.expense > 0 ? 3 : 0), backgroundColor: C.spendMark }]} />
            </View>
            </View>
            <Text style={styles.monthLabel}>{d.label}</Text>
            <Text style={[styles.monthAmt, { color: d.net >= 0 ? C.good : C.bad }]}>
            <Private kind="totals">{d.net >= 0 ? '+' : ''}${Math.round(Math.abs(d.net))}</Private>
            </Text>
            </Pressable>
        ))}
        </View>
        </View>
    )
}

import React from 'react'
import { Private } from '../../../shared/ui/Private'

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const makeStyles = (C: Palette) => StyleSheet.create({
    container: { backgroundColor: C.surface, borderRadius: 14, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: C.line },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    title: { fontSize: 18, fontWeight: '700', color: C.ink },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    legend: { flexDirection: 'row', gap: 12 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontSize: 11, color: C.text },
    toggleBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16, borderWidth: 1, borderColor: C.primary },
    toggleBtnText: { fontSize: 11, color: C.primary, fontWeight: '600' },
    chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 160 },
    monthCol: { flex: 1, alignItems: 'center', borderRadius: 8, paddingBottom: 4 },
    monthActive: { backgroundColor: C.primarySoft },
    monthDim: { opacity: 0.45 },
    detail: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, minHeight: 22, marginBottom: 8 },
    detailTitle: { fontSize: 13, fontWeight: '700', color: C.ink },
    detailText: { fontSize: 12, fontWeight: '600' },
    detailHint: { fontSize: 11, color: C.faint },
    bars: { height: 120, justifyContent: 'flex-end', width: '100%' },
    barPair: { flexDirection: 'row', gap: 2, alignItems: 'flex-end', justifyContent: 'center' },
    bar: { width: 10, borderRadius: 3 },
    monthLabel: { fontSize: 10, color: C.muted, marginTop: 4 },
    monthAmt: { fontSize: 9, fontWeight: '600', marginTop: 2 },
})