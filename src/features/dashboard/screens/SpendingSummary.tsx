import { useTheme, useStyles, Palette } from '../../../shared/theme/theme'
import { View, Text, StyleSheet } from 'react-native'
import { tabular, money, dollars } from '../logic/display'

interface Props {
    heading: string               // "Spent in October", "Spent this week"…
    spent: number
    planned: number               // total spending budget for the period (0 = none set)
    elapsed: number               // 0..1 of the period gone by
    income: number
    saved: number
    left: number                  // income - spent
    remainingDays: number | null  // days left in a current period, else null
    wide: boolean
}

/**
 * The top of the dashboard: how much you've spent against your plan, with a marker for where
 * you'd be if you spent evenly, plus what came in, what you saved and what's left.
 */
export function SpendingSummary({ heading, spent, planned, elapsed, income, saved, left, remainingDays, wide }: Props) {
    const { c: C } = useTheme()
    const styles = useStyles(makeStyles)
    const hasPlan = planned > 0
    const share = hasPlan ? spent / planned : 0
    const expected = planned * elapsed
    const ahead = spent - expected           // > 0: spending faster than planned
    const over = hasPlan && spent > planned

    let note: string
    if (!hasPlan) note = 'Set monthly amounts on the Budget tab to see how your spending is pacing.'
    else if (over) note = `${money(spent - planned)} over your plan.`
    else if (remainingDays !== null && remainingDays > 0) {
        const pace = Math.abs(ahead) < planned * 0.03 ? 'Right on track.'
            : ahead > 0 ? `${dollars(ahead)} more than planned by today.` : `${dollars(-ahead)} less than planned by today.`
        note = `${money(planned - spent)} left for the next ${remainingDays} day${remainingDays === 1 ? '' : 's'}. ${pace}`
    } else note = `${money(planned - spent)} under your plan.`

    return (
        <View style={[styles.panel, wide && styles.panelWide]}>
            <View style={styles.main}>
                <Text style={styles.label}>{heading}</Text>
                <View style={styles.amountRow}>
                    <Text style={[styles.amount, tabular]}>{money(spent)}</Text>
                    {hasPlan && <Text style={[styles.of, tabular]}>of {money(planned)} planned</Text>}
                </View>
                {hasPlan && (
                    <View style={styles.meter} accessibilityLabel={`${Math.round(share * 100)}% of your plan spent`}>
                        <View style={[styles.fill, { width: `${Math.min(100, share * 100)}%` }, over && styles.fillOver]} />
                        {elapsed > 0 && elapsed < 1 && <View style={[styles.today, { left: `${elapsed * 100}%` }]} accessibilityLabel="Today" />}
                    </View>
                )}
                <Text style={styles.note}>{note}</Text>
            </View>
            <View style={[styles.side, wide && styles.sideWide]}>
                <Figure label="Earned" value={income} tone="income" />
                {saved >= 0 ? <Figure label="Saved" value={saved} tone="saved" /> : <Figure label="Taken from savings" value={-saved} />}
                <Figure label="Earned minus spent" value={left} signed />
            </View>
        </View>
    )
}

// The panel is a deep theme color in light and dark alike, so these light tints of the money colors read well on it
const ON_PANEL = { income: '#8ff0bf', spend: '#ffb0a5', saved: '#cfc1ff', over: '#ff8b7c' }

function Figure({ label, value, signed, tone }: { label: string; value: number; signed?: boolean; tone?: 'income' | 'saved' }) {
    const styles = useStyles(makeStyles)
    const color = signed ? (value >= 0 ? ON_PANEL.income : ON_PANEL.spend) : tone ? ON_PANEL[tone] : '#ffffff'
    return (
        <View style={styles.figure}>
            <Text style={styles.figLabel}>{label}</Text>
            <Text style={[styles.figValue, tabular, { color }]}>{signed && value > 0 ? '+' : ''}{money(value)}</Text>
        </View>
    )
}

const makeStyles = (C: Palette) => StyleSheet.create({
    panel: { backgroundColor: C.panel, borderRadius: 16, padding: 20, gap: 20, marginBottom: 16 },
    panelWide: { flexDirection: 'row', alignItems: 'stretch', padding: 24 },
    main: { flex: 1, minWidth: 0 },
    label: { fontSize: 14, color: C.onPanelMuted, fontWeight: '600' },
    amountRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 10, marginTop: 4 },
    amount: { fontSize: 38, fontWeight: '700', color: '#ffffff', letterSpacing: -0.5 },
    of: { fontSize: 16, color: C.onPanelMuted },
    meter: { height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.14)', marginTop: 14, overflow: 'visible' },
    fill: { height: 10, borderRadius: 5, backgroundColor: C.onPanelMuted },
    fillOver: { backgroundColor: ON_PANEL.over },
    today: { position: 'absolute', top: -4, width: 2, height: 18, marginLeft: -1, backgroundColor: '#ffffff', borderRadius: 1 },
    note: { fontSize: 14, color: '#ffffff', opacity: 0.88, marginTop: 12, lineHeight: 20 },
    side: { flexDirection: 'row', gap: 16, flexWrap: 'wrap', borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.12)', paddingTop: 16 },
    sideWide: { flexDirection: 'column', justifyContent: 'center', gap: 12, borderTopWidth: 0, borderLeftWidth: 1, paddingTop: 0, paddingLeft: 24, minWidth: 210 },
    figure: { minWidth: 90 },
    figLabel: { fontSize: 12, color: C.onPanelMuted },
    figValue: { fontSize: 17, fontWeight: '700', marginTop: 2 },
})
