import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { TransactionCard } from '../../components/TransactionCard'

interface Props {
    upcoming: any[]
    transactions: any[]
}

export function RecentUpcoming({ upcoming, transactions }: Props) {
    return (
        <View style={styles.sideRow}>
        <View style={styles.sideCol}>
        <Text style={styles.sectionTitle}>Upcoming (Next 30 Days)</Text>
        <ScrollView>
        {upcoming.length === 0 ? (
            <Text style={styles.empty}>No upcoming recurring transactions.</Text>
        ) : (
            upcoming.map(t => (
                <View key={t.id + t.nextDate} style={styles.upcomingCard}>
                <View style={styles.upcomingLeft}>
                <Text style={styles.upcomingName}>{t.name || t.category_label || 'Transaction'}</Text>
                <Text style={styles.upcomingDate}>{t.nextDate} · {t.recurring}</Text>
                </View>
                <Text style={[styles.upcomingAmount, { color: t.type === 'expense' ? '#e74c3c' : '#27ae60' }]}>
                {t.type === 'expense' ? '-' : '+'}${Number(t.amount).toFixed(2)}
                </Text>
                </View>
            ))
        )}
        </ScrollView>
        </View>
        
        <View style={styles.sideCol}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        <ScrollView>
        {transactions.length === 0 ? (
            <Text style={styles.empty}>No transactions yet.</Text>
        ) : (
            transactions.slice(0, 10).map(t => (
                <TransactionCard key={t.id} transaction={t} />
            ))
        )}
        </ScrollView>
        </View>
        </View>
    )
}

const styles = StyleSheet.create({
    sideRow: { flexDirection: 'row', gap: 16, marginTop: 8 },
    sideCol: { flex: 1, maxHeight: 400 },
    sectionTitle: { fontSize: 18, fontWeight: '600', color: '#1a1a1a', marginBottom: 12, marginTop: 8 },
    empty: { textAlign: 'center', color: '#888', marginTop: 8, marginBottom: 16, fontSize: 14 },
    upcomingCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 0.5, borderColor: '#e0e0e0' },
    upcomingLeft: { flex: 1 },
    upcomingName: { fontSize: 14, fontWeight: '500', color: '#1a1a1a' },
    upcomingDate: { fontSize: 12, color: '#888', marginTop: 2 },
    upcomingAmount: { fontSize: 15, fontWeight: '600' },
})