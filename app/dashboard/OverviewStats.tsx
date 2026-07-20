import { View, Text, StyleSheet } from 'react-native'

interface Props {
    income: number
    expenses: number
    savings: number
    budgetItems: any[]
    budgetAmounts: any[]
    transactions: any[]
    year: number
}

export function OverviewStats({ income, expenses, savings, budgetItems, budgetAmounts, transactions, year }: Props) {
    const net = income - expenses - savings
    const saveRate = income > 0 ? ((savings / income) * 100).toFixed(1) : '0.0'
    const expenseRatio = income > 0 ? ((expenses / income) * 100).toFixed(1) : '0.0'
    
    // Budget health
    const expenseItems = budgetItems.filter(i => i.type === 'expense')
    let totalPlanned = 0
    let totalActual = 0
    let overBudgetCount = 0
    
    expenseItems.forEach(item => {
        const planned = budgetAmounts
        .filter(a => a.budget_item_id === item.id)
        .reduce((s, a) => s + a.amount, 0)
        const actual = transactions
        .filter(t => t.category_label === item.name && t.type === 'expense' && new Date(t.date).getFullYear() === year)
        .reduce((s, t) => s + t.amount, 0)
        totalPlanned += planned
        totalActual += actual
        if (actual > planned && planned > 0) overBudgetCount++
    })
    
    const score = totalPlanned > 0
    ? Math.max(0, Math.min(100, Math.round((1 - (totalActual - totalPlanned) / totalPlanned) * 100)))
    : null
    const scoreColor = score === null ? '#aaa' : score >= 80 ? '#27ae60' : score >= 60 ? '#f1c40f' : '#e74c3c'
    const scoreLabel = score === null ? 'No budget' : score >= 80 ? 'On Track' : score >= 60 ? 'Watch Out' : 'Over Budget'
    
    return (
        <View style={styles.container}>
        <View style={styles.card}>
        <Text style={styles.label}>Net Saved</Text>
        <Text style={[styles.value, { color: net >= 0 ? '#27ae60' : '#e74c3c' }]}>
        {net >= 0 ? '+' : ''}${net.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </Text>
        <View style={[styles.badge, { backgroundColor: parseFloat(expenseRatio) <= 70 ? '#eafaf1' : '#fdedec' }]}>
        <Text style={[styles.badgeText, { color: parseFloat(expenseRatio) <= 70 ? '#27ae60' : '#e74c3c' }]}>
        {expenseRatio}% spent
        </Text>
        </View>
        </View>
        
        <View style={styles.card}>
        <Text style={styles.label}>Savings Rate</Text>
        <Text style={[styles.value, {
            color: parseFloat(saveRate) >= 20 ? '#27ae60' : parseFloat(saveRate) >= 10 ? '#e67e22' : '#e74c3c'
        }]}>
        {saveRate}%
        </Text>
        <Text style={styles.sub}>of income saved</Text>
        </View>
        
        <View style={styles.card}>
        <Text style={styles.label}>Budget Health</Text>
        <Text style={[styles.value, { color: scoreColor }]}>
        {score !== null ? `${score}/100` : '—'}
        </Text>
        <Text style={[styles.sub, { color: scoreColor }]}>{scoreLabel}</Text>
        <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${score ?? 0}%`, backgroundColor: scoreColor }]} />
        </View>
        </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: { gap: 8, width: 160 },
    card: { backgroundColor: '#fff', borderRadius: 10, padding: 10, borderWidth: 0.5, borderColor: '#e8e8e8' },
    label: { fontSize: 10, color: '#888', fontWeight: '500', marginBottom: 4, textTransform: 'uppercase' },
    value: { fontSize: 14, fontWeight: '700', marginBottom: 3 },
    badge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 20, alignSelf: 'flex-start' },
    badgeText: { fontSize: 9, fontWeight: '600' },
    sub: { fontSize: 10, color: '#aaa' },
    progressTrack: { height: 3, backgroundColor: '#e0e0e0', borderRadius: 2, overflow: 'hidden', marginTop: 4 },
    progressFill: { height: 3, borderRadius: 2 },
})