import { View, Text, StyleSheet } from 'react-native'

interface Props {
    balance: number
    income: number
    expenses: number
    savings: number
    year: number
}

export function OverviewCards({ balance, income, expenses, savings, year }: Props) {
    return (
        <View style={styles.container}>
            <Text style={styles.periodLabel}>Yearly Overview · {year}</Text>
            <View style={styles.balanceCard}>
                <View style={styles.balanceLeft}>
                    <Text style={styles.balanceLabel}>TOTAL BALANCE</Text>
                    <Text style={styles.balanceAmount}>
                        ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                </View>
                <View style={styles.balanceStats}>
                    <View style={styles.balanceStat}>
                        <Text style={styles.balanceStatLabel}>↑ Income</Text>
                        <Text style={[styles.balanceStatValue, { color: '#2ecc71' }]}>
                            ${income.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </Text>
                    </View>
                    <View style={styles.balanceDivider} />
                    <View style={styles.balanceStat}>
                        <Text style={styles.balanceStatLabel}>↓ Expenses</Text>
                        <Text style={[styles.balanceStatValue, { color: '#e74c3c' }]}>
                            ${expenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </Text>
                    </View>
                    <View style={styles.balanceDivider} />
                    <View style={styles.balanceStat}>
                        <Text style={styles.balanceStatLabel}>⬆ Savings</Text>
                        <Text style={[styles.balanceStatValue, { color: '#3498db' }]}>
                            ${savings.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </Text>
                    </View>
                </View>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: { marginBottom: 12 },
    periodLabel: { fontSize: 12, color: '#888', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
    balanceCard: {
        backgroundColor: '#2c3e50', borderRadius: 14, padding: 18,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
    },
    balanceLeft: {},
    balanceLabel: { fontSize: 11, color: '#95a5a6', marginBottom: 4, letterSpacing: 0.5 },
    balanceAmount: { fontSize: 34, fontWeight: '700', color: '#fff' },
    balanceStats: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    balanceStat: { alignItems: 'flex-end' },
    balanceStatLabel: { fontSize: 11, color: '#95a5a6', marginBottom: 3 },
    balanceStatValue: { fontSize: 14, fontWeight: '600' },
    balanceDivider: { width: 1, height: 32, backgroundColor: '#3d5166' },
})