import { View, Text, StyleSheet } from 'react-native'
import { Transaction } from '../types'
import { useTheme, useStyles, Palette, tabular } from '../lib/theme'
import { amountText, displayDate } from '../app/transactions/listLogic'
import { todayString } from '../lib/entry'

interface Props {
    transaction: Transaction
}

/** One transaction: its name and date, and the amount colored by which way the money went. */
export function TransactionCard({ transaction }: Props) {
    const { c: C } = useTheme()
    const styles = useStyles(makeStyles)
    const { text, direction } = amountText(transaction)

    return (
        <View style={styles.card}>
            <View style={styles.left}>
                <Text style={styles.name} numberOfLines={2}>
                    {transaction.name || transaction.note || transaction.category_label || transaction.category?.name || 'Transaction'}
                </Text>
                <Text style={styles.date}>{displayDate(transaction.date, todayString())}</Text>
            </View>
            <Text style={[styles.amount, tabular, { color: direction === 'in' ? C.good : direction === 'move' ? C.move : C.ink }]}>
                {text}
            </Text>
        </View>
    )
}

const makeStyles = (C: Palette) => StyleSheet.create({
    card: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12,
        padding: 16, backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.line, marginBottom: 10,
    },
    left: { flex: 1, minWidth: 0 },
    name: { fontSize: 15, fontWeight: '500', color: C.ink },
    date: { fontSize: 12, color: C.muted, marginTop: 2 },
    amount: { fontSize: 15, fontWeight: '600' },
})
