import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useTransactions } from '../hooks/useTransactions'
import { useTransactionStore } from '../store/useTransactionStore'
import { TransactionCard } from '../components/TransactionCard'

export default function Dashboard() {
    useTransactions()
    const { transactions } = useTransactionStore()
    
    const income = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)
    
    const expenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)
    
    const balance = income - expenses
    
    return (
        <ScrollView style={styles.container}>
        <Text style={styles.heading}>Overview</Text>
        
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
        
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        
        {transactions.length === 0 ? (
            <Text style={styles.empty}>No transactions yet. Add one to get started!</Text>
        ) : (
            transactions.slice(0, 10).map(t => (
                <TransactionCard key={t.id} transaction={t} />
            ))
        )}
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f6fa', padding: 20 },
    heading: { fontSize: 24, fontWeight: '700', color: '#1a1a1a', marginBottom: 16 },
    balanceCard: {
        backgroundColor: '#2c3e50',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        marginBottom: 16,
    },
    balanceLabel: { fontSize: 14, color: '#95a5a6', marginBottom: 8 },
    balanceAmount: { fontSize: 36, fontWeight: '700', color: '#fff' },
    row: { flexDirection: 'row', gap: 12, marginBottom: 24 },
    summaryCard: { flex: 1, borderRadius: 12, padding: 16 },
    summaryLabel: { fontSize: 13, color: '#666', marginBottom: 4 },
    summaryAmount: { fontSize: 20, fontWeight: '600' },
    sectionTitle: { fontSize: 18, fontWeight: '600', color: '#1a1a1a', marginBottom: 12 },
    empty: { textAlign: 'center', color: '#888', marginTop: 40, fontSize: 14 },
})