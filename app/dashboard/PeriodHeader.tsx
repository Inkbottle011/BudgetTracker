import { useTheme, useStyles, Palette } from '../../lib/theme'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'

import { Period } from './summary'

const VIEWS: { key: Period; label: string }[] = [
    { key: 'day', label: 'Day' }, { key: 'week', label: 'Week' }, { key: 'month', label: 'Month' }, { key: 'year', label: 'Year' },
]

interface Props {
    title: string
    view: Period
    onPrev: () => void
    onNext: () => void
    onView: (v: Period) => void
    onToday?: () => void
}

/** The one period picker: everything on the dashboard follows it. */
export function PeriodHeader({ title, view, onPrev, onNext, onView, onToday }: Props) {
    const { c: C } = useTheme()
    const styles = useStyles(makeStyles)
    return (
        <View style={styles.row}>
            <View style={styles.titleGroup}>
                <TouchableOpacity accessibilityLabel={`Previous ${view}`} onPress={onPrev} style={styles.arrow}><Text style={styles.arrowText}>‹</Text></TouchableOpacity>
                <Text style={styles.title} accessibilityRole="header">{title}</Text>
                <TouchableOpacity accessibilityLabel={`Next ${view}`} onPress={onNext} style={styles.arrow}><Text style={styles.arrowText}>›</Text></TouchableOpacity>
                {onToday && <TouchableOpacity onPress={onToday}><Text style={styles.today}>Back to today</Text></TouchableOpacity>}
            </View>
            <View style={styles.segment}>
                {VIEWS.map(v => (
                    <TouchableOpacity key={v.key} onPress={() => onView(v.key)} style={[styles.segBtn, view === v.key && styles.segOn]}
                        accessibilityRole="button" accessibilityState={{ selected: view === v.key }}>
                        <Text style={[styles.segText, view === v.key && styles.segTextOn]}>{v.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    )
}

const makeStyles = (C: Palette) => StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
    titleGroup: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    title: { fontSize: 26, fontWeight: '700', color: C.ink, minWidth: 90 },
    arrow: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    arrowText: { fontSize: 26, lineHeight: 28, color: C.muted },
    today: { fontSize: 13, color: C.primary, fontWeight: '600', marginLeft: 8 },
    segment: { flexDirection: 'row', backgroundColor: C.track, borderRadius: 9, padding: 3 },
    segBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 7 },
    segOn: { backgroundColor: C.surface, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
    segText: { fontSize: 13, color: C.muted, fontWeight: '600' },
    segTextOn: { color: C.ink },
})
