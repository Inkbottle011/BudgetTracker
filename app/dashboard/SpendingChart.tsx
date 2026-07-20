import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import Svg, { Circle, G } from 'react-native-svg'

const CHART_COLORS = [
    '#e74c3c', '#2980b9', '#27ae60', '#8e44ad',
    '#e67e22', '#16a085', '#c0392b', '#f39c12',
]

interface SpendingData {
    label: string
    amount: number
}

interface Props {
    data: SpendingData[]
    chartType: 'bar' | 'pie'
    onToggleChart: () => void
}

export function SpendingChart({ data, chartType, onToggleChart }: Props) {
    if (data.length === 0) {
        return (
            <View style={styles.empty}>
            <Text style={styles.emptyText}>No expense data for this period.</Text>
            </View>
        )
    }
    
    const total = data.reduce((s, d) => s + d.amount, 0)
    const max = Math.max(...data.map(d => d.amount))
    
    function renderBar() {
        return (
            <View style={styles.barChart}>
            {data.map((d, i) => (
                <View key={d.label} style={styles.barRow}>
                <Text style={styles.barLabel} numberOfLines={1}>{d.label}</Text>
                <View style={styles.barTrack}>
                <View style={[styles.barFill, {
                    width: `${(d.amount / max) * 100}%`,
                    backgroundColor: CHART_COLORS[i % CHART_COLORS.length]
                }]} />
                </View>
                <Text style={styles.barAmount}>${d.amount.toLocaleString()}</Text>
                </View>
            ))}
            </View>
        )
    }
    
    function renderPie() {
        const size = 160
        const radius = 60
        const cx = size / 2
        const cy = size / 2
        const circumference = 2 * Math.PI * radius
        
        // Build stroke-dasharray segments
        let offset = 0
        const segments = data.map((d, i) => {
            const pct = d.amount / total
            const dash = pct * circumference
            const gap = circumference - dash
            const seg = { dash, gap, offset, color: CHART_COLORS[i % CHART_COLORS.length] }
            offset += dash
            return seg
        })
        
        return (
            <View style={styles.pieContainer}>
            <View style={styles.pieWrapper}>
            <Svg width={size} height={size}>
            <G rotation="-90" origin={`${cx}, ${cy}`}>
            {segments.map((seg, i) => (
                <Circle
                key={i}
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={28}
                strokeDasharray={`${seg.dash} ${seg.gap}`}
                strokeDashoffset={-seg.offset}
                />
            ))}
            </G>
            </Svg>
            <View style={styles.pieCenter}>
            <Text style={styles.pieTotalLabel}>Total</Text>
            <Text style={styles.pieTotalAmount}>${Math.round(total).toLocaleString()}</Text>
            </View>
            </View>
            <View style={styles.pieLegend}>
            {data.map((d, i) => {
                const pct = ((d.amount / total) * 100).toFixed(1)
                return (
                    <View key={d.label} style={styles.legendRow}>
                    <View style={[styles.legendDot, { backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }]} />
                    <Text style={styles.legendLabel} numberOfLines={1}>{d.label}</Text>
                    <Text style={styles.legendPct}>{pct}%</Text>
                    <Text style={styles.legendAmount}>${d.amount.toLocaleString()}</Text>
                    </View>
                )
            })}
            </View>
            </View>
        )
    }
    
    return (
        <View style={styles.container}>
        <View style={styles.header}>
        <Text style={styles.title}>Spending by Category</Text>
        <TouchableOpacity style={styles.toggleBtn} onPress={onToggleChart}>
        <Text style={styles.toggleBtnText}>{chartType === 'bar' ? '⬤ Pie' : '▬ Bar'}</Text>
        </TouchableOpacity>
        </View>
        {chartType === 'bar' ? renderBar() : renderPie()}
        </View>
    )
}

const styles = StyleSheet.create({
    container: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 0.5, borderColor: '#e0e0e0'},
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    title: { fontSize: 16, fontWeight: '700', color: '#2c3e50' },
    toggleBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, borderWidth: 1, borderColor: '#2980b9' },
    toggleBtnText: { fontSize: 12, color: '#2980b9', fontWeight: '600' },
    empty: { backgroundColor: '#fff', borderRadius: 12, padding: 24, alignItems: 'center', marginBottom: 16, borderWidth: 0.5, borderColor: '#e0e0e0' },
    emptyText: { color: '#aaa', fontSize: 14 },
    barChart: { gap: 10 },
    barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    barLabel: { width: 100, fontSize: 12, color: '#555' },
    barTrack: { flex: 1, height: 20, backgroundColor: '#f0f0f0', borderRadius: 4, overflow: 'hidden' },
    barFill: { height: 20, borderRadius: 4 },
    barAmount: { width: 70, fontSize: 12, color: '#2c3e50', fontWeight: '600', textAlign: 'right' },
    pieContainer: { flexDirection: 'row', gap: 16, alignItems: 'center',justifyContent: 'center' },
    pieWrapper: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    pieLegend: { flex: 1, gap: 8 },
    pieCenter: { position: 'absolute', alignItems: 'center' },
    pieTotalLabel: { fontSize: 11, color: '#888' },
    pieTotalAmount: { fontSize: 13, fontWeight: '700', color: '#2c3e50' },
    legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
    legendLabel: { flex: 1, fontSize: 12, color: '#555' },
    legendPct: { fontSize: 12, color: '#888', width: 40, textAlign: 'right' },
    legendAmount: { fontSize: 12, fontWeight: '600', color: '#2c3e50', width: 70, textAlign: 'right' },
})