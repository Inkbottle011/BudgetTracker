import { View, Text, StyleSheet } from 'react-native'

interface Props {
    balance: number
    income: number
    expenses: number
}

export function OverviewCards({ balance, income, expenses }: Props) {
    return (
        <>
            <View style={styles.balanceCard}>
                <Text style={styles.balanceLabel}>Total Balance</Text>
                <Text style={styles.balanceAmount}>${balance.toFixed(2)}</Text>
            </View>
            <View style={styles.row}>
                <View style={[styles.summaryCard, { backgroundColor: '#eafaf1' }]}>
                    <Text style={styles.summaryLabel}>Income</Text>
                    <Text style={[styles.summaryAmount, { color: '#2ecc71' }]}>${income.toFixed(2)}</Text>
                </View>
                <View style={[styles.summaryCard, { backgroundColor: '#fdedec' }]}>
                    <Text style={styles.summaryLabel}>Expenses</Text>
                    <Text style={[styles.summaryAmount, { color: '#e74c3c' }]}>${expenses.toFixed(2)}</Text>
                </View>
            </View>
        </>
    )
}

const styles = StyleSheet.create({
    balanceCard: { backgroundColor: '#2c3e50', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 16 },
    balanceLabel: { fontSize: 14, color: '#95a5a6', marginBottom: 8 },
    balanceAmount: { fontSize: 36, fontWeight: '700', color: '#fff' },
    row: { flexDirection: 'row', gap: 12, marginBottom: 24 },
    summaryCard: { flex: 1, borderRadius: 12, padding: 16 },
    summaryLabel: { fontSize: 13, color: '#666', marginBottom: 4 },
    summaryAmount: { fontSize: 20, fontWeight: '600' },
})