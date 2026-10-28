// Charges your bank hasn't posted yet, above your transaction list. They're added to the list (and to
// your totals) once the bank posts them, so they can't be edited here.
import { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { loadPendingCharges, shortDate, type PendingCharge } from '../../bank/api'
import { useTheme, useStyles, Palette, tabular } from '../../../shared/theme/theme'
import { Section } from '../../../shared/ui/ui'
import { formatMoney } from '../../../shared/money/format'
import { Private } from '../../../shared/ui/Private'

/** `refreshWhen` changes whenever your transactions reload, so this list stays in step. */
export function PendingPanel({ refreshWhen }: { refreshWhen: unknown }) {
    const { c: C } = useTheme()
    const styles = useStyles(makeStyles)
    const [pending, setPending] = useState<PendingCharge[]>([])
    useEffect(() => { loadPendingCharges().then(setPending) }, [refreshWhen])
    if (pending.length === 0) return null
    return (
        <Section title={`Pending at your bank (${pending.length})`}>
            <Text style={styles.help}>These are added to your list once your bank posts them, usually within a few days.</Text>
            {pending.map((p, i) => (
                <View key={p.id} style={[styles.row, i > 0 && styles.rowLine]}>
                    <Text style={[styles.date, tabular]}>{shortDate(p.date)}</Text>
                    <Text style={styles.name} numberOfLines={1}>{p.name || 'Pending charge'}</Text>
                    <Text style={[styles.amount, tabular, p.money_in && { color: C.good }]}><Private>{p.money_in ? '+' : '-'}{formatMoney(p.amount)}</Private></Text>
                </View>
            ))}
        </Section>
    )
}

const makeStyles = (C: Palette) => StyleSheet.create({
    help: { fontSize: 13, color: C.muted, lineHeight: 18, marginBottom: 6 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
    rowLine: { borderTopWidth: 1, borderColor: C.line },
    date: { fontSize: 13, color: C.muted, width: 52 },
    name: { flex: 1, fontSize: 14, color: C.text, fontStyle: 'italic' },
    amount: { fontSize: 14, fontWeight: '600', color: C.ink },
})
