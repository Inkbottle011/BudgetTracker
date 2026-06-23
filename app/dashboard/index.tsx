import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { useDashboardLogic, MONTHS } from './useDashboardLogic'
import { OverviewCards } from './OverviewCards'
import { ActualVsPlanned } from './ActualVsPlanned'
import { SpendingChart } from './SpendingChart'
import { RecentUpcoming } from './RecentUpcoming'
import { MonthlyTrend } from './MonthlyTrend'
import { BudgetHealthScore } from './BudgetHealthScore'
import { TopSpendingCategories } from './TopSpendingCategories'

export default function Dashboard() {
    const logic = useDashboardLogic()
    
    return (
        <ScrollView style={styles.container}>
        <Text style={styles.heading}>Overview</Text>
        
        <OverviewCards
        balance={logic.balance}
        income={logic.income}
        expenses={logic.expenses}
        />
        
        {/* Monthly Trend */}
        <MonthlyTrend
        transactions={logic.transactions}
        selectedYear={logic.selectedYear}
        />
        
        {/* Budget Health + Savings Rate */}
        <BudgetHealthScore
        budgetItems={logic.budgetItems}
        budgetAmounts={logic.budgetAmounts}
        transactions={logic.transactions}
        selectedMonth={logic.selectedMonth}
        selectedYear={logic.selectedYear}
        view={logic.view}
        income={logic.income}
        />
        
        {/* Period selector — shared by chart and actual vs planned */}
        <View style={styles.toggleRow}>
        <TouchableOpacity
        style={[styles.toggleBtn, logic.view === 'month' && styles.toggleBtnActive]}
        onPress={() => logic.setView('month')}
        >
        <Text style={[styles.toggleBtnText, logic.view === 'month' && styles.toggleBtnTextActive]}>Monthly</Text>
        </TouchableOpacity>
        <TouchableOpacity
        style={[styles.toggleBtn, logic.view === 'year' && styles.toggleBtnActive]}
        onPress={() => logic.setView('year')}
        >
        <Text style={[styles.toggleBtnText, logic.view === 'year' && styles.toggleBtnTextActive]}>Yearly</Text>
        </TouchableOpacity>
        </View>
        
        <View style={styles.periodRow}>
        <TouchableOpacity onPress={() => logic.setSelectedYear(y => y - 1)} style={styles.periodBtn}>
        <Text style={styles.periodBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.periodText}>{logic.selectedYear}</Text>
        <TouchableOpacity onPress={() => logic.setSelectedYear(y => y + 1)} style={styles.periodBtn}>
        <Text style={styles.periodBtnText}>→</Text>
        </TouchableOpacity>
        {logic.view === 'month' && (
            <>
            <View style={styles.periodDivider} />
            <TouchableOpacity onPress={() => logic.setSelectedMonth(m => m === 1 ? 12 : m - 1)} style={styles.periodBtn}>
            <Text style={styles.periodBtnText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.periodText}>{MONTHS[logic.selectedMonth - 1]}</Text>
            <TouchableOpacity onPress={() => logic.setSelectedMonth(m => m === 12 ? 1 : m + 1)} style={styles.periodBtn}>
            <Text style={styles.periodBtnText}>→</Text>
            </TouchableOpacity>
            </>
        )}
        </View>
        
        {/* Spending Chart */}
        <SpendingChart
        data={logic.getSpendingByCategory()}
        chartType={logic.chartType}
        onToggleChart={() => logic.setChartType(c => c === 'bar' ? 'pie' : 'bar')}
        />
        
        {/* Top Spending Categories */}
        <TopSpendingCategories data={logic.getSpendingByCategory()} />
        
        {/* Actual vs Planned */}
        <Text style={styles.sectionTitle}>Actual vs Planned</Text>
        {logic.budgetItems.length === 0 ? (
            <Text style={styles.empty}>Add budget items to see actual vs planned.</Text>
        ) : (
            <ActualVsPlanned
            budgetItems={logic.budgetItems}
            selectedMonth={logic.selectedMonth}
            getPlanned={logic.getPlanned}
            getActual={logic.getActual}
            />
        )}
        
        <RecentUpcoming
        upcoming={logic.upcoming}
        transactions={logic.transactions}
        />
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f6fa', padding: 20 },
    heading: { fontSize: 24, fontWeight: '700', color: '#1a1a1a', marginBottom: 16 },
    sectionTitle: { fontSize: 18, fontWeight: '600', color: '#1a1a1a', marginBottom: 12, marginTop: 8 },
    empty: { textAlign: 'center', color: '#888', marginTop: 8, marginBottom: 16, fontSize: 14 },
    toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    toggleBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#f8f9fa' },
    toggleBtnActive: { backgroundColor: '#2c3e50', borderColor: '#2c3e50' },
    toggleBtnText: { fontSize: 13, color: '#555', fontWeight: '500' },
    toggleBtnTextActive: { color: '#fff' },
    periodRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
    periodBtn: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#2980b9' },
    periodBtnText: { fontSize: 14, color: '#2980b9', fontWeight: '700' },
    periodText: { fontSize: 15, fontWeight: '600', color: '#2c3e50', minWidth: 40, textAlign: 'center' },
    periodDivider: { width: 1, height: 20, backgroundColor: '#ddd', marginHorizontal: 4 },
})