import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { formatBalance, shortDate, PossibleDuplicate, DuplicateChoice } from '../logic/bank'
import { useTheme, useStyles, Palette, tabular } from '../../../shared/theme/theme'
import { Button } from '../../../shared/ui/ui'

const CHOICES: { label: string; choice: DuplicateChoice }[] = [
    { label: 'Keep mine', choice: 'keep_mine' },
    { label: "Use bank's", choice: 'use_bank' },
    { label: 'Keep both', choice: 'keep_both' },
]

/** Bank transactions that look like ones you already have: you pick which to keep. */
export function PossibleDuplicates({ items, busyId, onResolve }: {
    items: PossibleDuplicate[]
    busyId: string | null
    onResolve: (item: PossibleDuplicate, choice: DuplicateChoice) => void
}) {
    const { c: C } = useTheme()
    const styles = useStyles(makeStyles)
    if (!items.length) return null
    return (
        <View style={styles.box}>
            <Text style={styles.title}>Possible duplicates ({items.length})</Text>
            <Text style={styles.help}>
                Same amount within a few days of one you already have, but named differently. They aren't counted until you choose.
            </Text>
            {items.map(item => (
                <View key={item.id} style={styles.item}>
                    <Text style={styles.amount}>{formatBalance(item.amount)}</Text>
                    <Text style={styles.line}>
                        {item.mine ? `Yours: ${shortDate(item.mine.date)} · ${item.mine.name || item.mine.note || '(no name)'}` : 'Yours: deleted since'}
                    </Text>
                    <Text style={styles.line}>{`Bank's: ${shortDate(item.date)} · ${item.name ?? ''}`}</Text>
                    {busyId === item.id ? <ActivityIndicator size="small" color={C.warn} style={styles.spinner} /> : (
                        <View style={styles.row}>
                            {CHOICES.map(c => (
                                <Button key={c.choice} variant="secondary" small label={c.label}
                                    onPress={() => onResolve(item, c.choice)} disabled={!!busyId} />
                            ))}
                        </View>
                    )}
                </View>
            ))}
        </View>
    )
}

const makeStyles = (C: Palette) => StyleSheet.create({
    box: { backgroundColor: C.warnSoft, borderRadius: 10, padding: 14, marginVertical: 10, gap: 4 },
    title: { fontSize: 15, fontWeight: '700', color: C.warn },
    help: { fontSize: 13, color: C.text, lineHeight: 18, marginBottom: 4 },
    item: { borderTopWidth: 1, borderColor: C.line, paddingTop: 10, marginTop: 6 },
    amount: { fontSize: 15, fontWeight: '600', color: C.ink, ...tabular },
    line: { fontSize: 13, color: C.text, marginTop: 2 },
    row: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
    spinner: { alignSelf: 'flex-start', marginTop: 8 },
})
