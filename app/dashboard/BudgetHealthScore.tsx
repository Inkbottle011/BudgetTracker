import { View, Text, StyleSheet } from 'react-native'

interface Props {
    budgetItems: any[]
    budgetAmounts: any[]
    transactions: any[]
    selectedMonth: number
    selectedYear: number
    view: 'month' | 'year'
    income: number
}

export function BudgetHealthScore({ budgetItems, budgetAmounts, transactions, selectedMonth, selectedYear, view, income }: Props) {

    function getPlanned(itemId: string): number {
        if (view === 'month') {
            const a = budgetAmounts.find(a => a.budget_item_id === itemId && a.month === selectedMonth)
            return a ? a.amount : 0
        }
        return budgetAmounts.filter(a => a.budget_item_id === itemId).reduce((s, a) => s + a.amount, 0)
    }

    function getActual(itemName: string, itemType: string): number {
        return transactions
            .filter(t => {
                const matchCat = t.category_label === itemName
                const matchType = t.type === itemType
                if (view === 'month') {
                    return matchCat && matchType &&
                        new Date(t.date).getMonth() + 1 === selectedMonth &&
                        new Date(t.date).getFullYear() === selectedYear
                }
                return matchCat && matchType && new Date(t.date).getFullYear() === selectedYear
            })
            .reduce((s, t) => s + t.amount, 0)
    }

    // Calculate health score
    const expenseItems = budgetItems.filter(i => i.type === 'expense')
    let totalPlanned = 0
    let totalActual = 0
    let overBudgetCount = 0

    expenseItems.forEach(item => {
        const planned = getPlanned(item.id)
        const actual = getActual(item.name, item.type)
        totalPlanned += planned
        totalActual += actual
        if (actual > planned && planned > 0) overBudgetCount++
    })

    const score = totalPlanned > 0
        ? Math.max(0, Math.min(100, Math.round((1 - (totalActual - totalPlanned) / totalPlanned) * 100)))
        : null

    const scoreColor = score === null ? '#aaa' : score >= 80 ? '#27ae60' : score >= 60 ? '#f1c40f' : '#e74c3c'
    const scoreLabel = score === null ? 'No budget set' : score >= 80 ? 'On Track' : score >= 60 ? 'Watch Out' : 'Over Budget'

    // Savings rate
    const periodIncome = transactions
        .filter(t => {
            if (t.type !== 'income') return false
            if (view === 'month') {
                return new Date(t.date).getMonth() + 1 === selectedMonth &&
                    new Date(t.date).getFullYear() === selectedYear
            }
            return new Date(t.date).getFullYear() === selectedYear
        })
        .reduce((s, t) => s + t.amount, 0)

    const periodSavings = transactions
        .filter(t => {
            if (t.type !== 'savings') return false
            if (view === 'month') {
                return new Date(t.date).getMonth() + 1 === selectedMonth &&
                    new Date(t.date).getFullYear() === selectedYear
            }
            return new Date(t.date).getFullYear() === selectedYear
        })
        .reduce((s, t) => s + t.amount, 0)

    const savingsRate = periodIncome > 0 ? ((periodSavings / periodIncome) * 100).toFixed(1) : null

    return (
        <View style={styles.row}>
            {/* Budget Health Score */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Budget Health</Text>
                <View style={styles.scoreCircle}>
                    <Text style={[styles.scoreNumber, { color: scoreColor }]}>
                        {score !== null ? score : '—'}
                    </Text>
                    {score !== null ? <Text style={styles.scoreSlash}>/100</Text> : null}
                </View>
                <Text style={[styles.scoreLabel, { color: scoreColor }]}>{scoreLabel}</Text>
                {overBudgetCount > 0 ? (
                    <Text style={styles.scoreDetail}>{overBudgetCount} categor{overBudgetCount === 1 ? 'y' : 'ies'} over budget</Text>
                ) : null}
                <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, {
                        width: `${score ?? 0}%`,
                        backgroundColor: scoreColor
                    }]} />
                </View>
            </View>

            {/* Savings Rate */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Savings Rate</Text>
                <View style={styles.scoreCircle}>
                    <Text style={[styles.scoreNumber, { color: savingsRate ? '#27ae60' : '#aaa' }]}>
                        {savingsRate ?? '—'}
                    </Text>
                    {savingsRate ? <Text style={styles.scoreSlash}>%</Text> : null}
                </View>
                <Text style={[styles.scoreLabel, { color: savingsRate ? '#27ae60' : '#aaa' }]}>
                    {savingsRate ? 'of income saved' : 'No income data'}
                </Text>
                {periodSavings > 0 ? (
                    <Text style={styles.scoreDetail}>${periodSavings.toLocaleString()} saved</Text>
                ) : null}
                <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, {
                        width: `${Math.min(parseFloat(savingsRate ?? '0'), 100)}%`,
                        backgroundColor: '#27ae60'
                    }]} />
                </View>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    card: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 0.5, borderColor: '#e0e0e0' },
    cardTitle: { fontSize: 13, fontWeight: '600', color: '#888', marginBottom: 12, textTransform: 'uppercase' },
    scoreCircle: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 4 },
    scoreNumber: { fontSize: 36, fontWeight: '700' },
    scoreSlash: { fontSize: 14, color: '#aaa', marginBottom: 8, marginLeft: 2 },
    scoreLabel: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
    scoreDetail: { fontSize: 12, color: '#888', marginBottom: 8 },
    progressTrack: { height: 4, backgroundColor: '#e0e0e0', borderRadius: 2, overflow: 'hidden', marginTop: 8 },
    progressFill: { height: 4, borderRadius: 2 },
})