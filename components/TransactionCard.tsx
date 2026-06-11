import { View, Text, StyleSheet } from 'react-native'
import { Transaction } from '../types'

interface Props {
  transaction: Transaction
}

export function TransactionCard({ transaction }: Props) {
  const isExpense = transaction.type === 'expense'

  return (
    <View style={styles.card}>
      <View style={styles.left}>
        <Text style={styles.note}>{transaction.note || transaction.category?.name || 'Transaction'}</Text>
        <Text style={styles.date}>{transaction.date}</Text>
      </View>
      <Text style={[styles.amount, isExpense ? styles.expense : styles.income]}>
        {isExpense ? '-' : '+'}${transaction.amount.toFixed(2)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  left: { flex: 1 },
  note: { fontSize: 15, fontWeight: '500', color: '#1a1a1a' },
  date: { fontSize: 12, color: '#888', marginTop: 2 },
  amount: { fontSize: 16, fontWeight: '600' },
  expense: { color: '#e74c3c' },
  income: { color: '#2ecc71' },
})