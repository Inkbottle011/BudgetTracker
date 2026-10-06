import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { formatBalance, shortDate, PossibleDuplicate, DuplicateChoice } from '../lib/bank'

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
                    {busyId === item.id ? <ActivityIndicator size="small" style={{ alignSelf: 'flex-start', marginTop: 6 }} /> : (
                        <View style={styles.row}>
                            {CHOICES.map(c => (
                                <TouchableOpacity key={c.choice} style={styles.choice} onPress={() => onResolve(item, c.choice)} disabled={!!busyId}>
                                    <Text style={styles.choiceText}>{c.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>
            ))}
        </View>
    )
}

const styles = StyleSheet.create({
    box: { backgroundColor: '#fff8e6', borderRadius: 10, padding: 12, marginVertical: 8, gap: 4 },
    title: { fontSize: 14, fontWeight: '700', color: '#7a5200' },
    help: { fontSize: 12, color: '#8a6d2f', marginBottom: 4 },
    item: { borderTopWidth: 0.5, borderColor: '#f0dca8', paddingTop: 8, marginTop: 4 },
    amount: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
    line: { fontSize: 13, color: '#555', marginTop: 2 },
    row: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
    choice: { borderWidth: 1, borderColor: '#d4a017', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
    choiceText: { fontSize: 13, fontWeight: '600', color: '#7a5200' },
})
