import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { useDashboardLogic, MONTHS } from './useDashboardLogic'
import { OverviewCards } from './OverviewCards'
import { OverviewStats } from './OverviewStats'
import { ActualVsPlanned } from './ActualVsPlanned'
import { SpendingChart } from './SpendingChart'
import { RecentUpcoming } from './RecentUpcoming'
import { MonthlyTrend } from './MonthlyTrend'
import { TopSpendingCategories } from './TopSpendingCategories'

export default function Dashboard() {
    const logic = useDashboardLogic()
    
    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        
        {/* Balance card — full width */}
        <OverviewCards
        balance={logic.balance}
        income={logic.overviewIncome}
        expenses={logic.overviewExpenses}
        savings={logic.overviewSavings}
        year={logic.currentYear}
        />
        
        {/* Stacked stats (left) + Monthly Trend (right) */}
        <View style={styles.overviewRow}>
        <OverviewStats
        income={logic.overviewIncome}
        expenses={logic.overviewExpenses}
        savings={logic.overviewSavings}
        budgetItems={logic.budgetItems}
        budgetAmounts={logic.budgetAmounts}
        transactions={logic.forTotals}
        year={logic.currentYear}
        />
        <View style={styles.trendCol}>
        <MonthlyTrend
        transactions={logic.forTotals}
        selectedYear={logic.selectedYear}
        />
        </View>
        </View>
        
        {/* Three column analysis layout */}
        <View style={styles.analysisRow}>
        
        {/* Left — period selector + spending + overspending */}
        <View style={styles.leftCol}>
        <View style={styles.periodRow}>
        <View style={styles.periodGroup}>
        <TouchableOpacity onPress={() => logic.setSelectedYear(y => y - 1)} style={styles.periodBtn}>
        <Text style={styles.periodBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.periodText}>{logic.selectedYear}</Text>
        <TouchableOpacity onPress={() => logic.setSelectedYear(y => y + 1)} style={styles.periodBtn}>
        <Text style={styles.periodBtnText}>→</Text>
        </TouchableOpacity>
        </View>
        {logic.view === 'month' && (
            <View style={styles.periodGroup}>
            <TouchableOpacity onPress={() => logic.setSelectedMonth(m => m === 1 ? 12 : m - 1)} style={styles.periodBtn}>
            <Text style={styles.periodBtnText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.periodText}>{MONTHS[logic.selectedMonth - 1]}</Text>
            <TouchableOpacity onPress={() => logic.setSelectedMonth(m => m === 12 ? 1 : m + 1)} style={styles.periodBtn}>
            <Text style={styles.periodBtnText}>→</Text>
            </TouchableOpacity>
            </View>
        )}
        <View style={styles.toggleRow}>
        <TouchableOpacity
        style={[styles.toggleBtn, logic.view === 'year' && styles.toggleBtnActive]}
        onPress={() => logic.setView('year')}
        >
        <Text style={[styles.toggleBtnText, logic.view === 'year' && styles.toggleBtnTextActive]}>Year</Text>
        </TouchableOpacity>
        <TouchableOpacity
        style={[styles.toggleBtn, logic.view === 'month' && styles.toggleBtnActive]}
        onPress={() => logic.setView('month')}
        >
        <Text style={[styles.toggleBtnText, logic.view === 'month' && styles.toggleBtnTextActive]}>Month</Text>
        </TouchableOpacity>
        </View>
        <Text style={styles.periodLabel}>{logic.period}</Text>
        </View>
        
        <SpendingChart
        data={logic.getSpendingByCategory()}
        chartType={logic.chartType}
        onToggleChart={() => logic.setChartType(c => c === 'bar' ? 'pie' : 'bar')}
        />
        <TopSpendingCategories
        data={logic.getSpendingByCategory()}
        budgetItems={logic.budgetItems}
        getPlanned={logic.getPlanned}
        />
        </View>
        
        {/* Middle — Actual vs Planned */}
        <View style={styles.midCol}>
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
        </View>
        
        {/* Right — Upcoming + Recent stacked */}
        <View style={[styles.rightCol, { flexDirection: 'column' }]}>
        <Text style={styles.sectionTitle}>Upcoming</Text>
        {logic.upcoming.length === 0 ? (
            <Text style={styles.empty}>No upcoming transactions.</Text>
        ) : (
            <ScrollView style={{ maxHeight: 200 }}>
            {logic.upcoming.map(t => (
                <View key={t.id + t.nextDate} style={styles.upcomingCard}>
                <Text style={styles.upcomingName} numberOfLines={1}>{t.name || t.category_label || 'Transaction'}</Text>
                <Text style={styles.upcomingDate}>{t.nextDate}</Text>
                <Text style={[styles.upcomingAmount, { color: t.type === 'expense' ? '#e74c3c' : '#27ae60' }]}>
                {t.type === 'expense' ? '-' : '+'}${Number(t.amount).toFixed(2)}
                </Text>
                </View>
            ))}
            </ScrollView>
        )}
        
        <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Recent</Text>
        <ScrollView style={{ maxHeight: 270 }}>
        {logic.transactions.slice(0, 15).map(t => (
            <View key={t.id} style={styles.upcomingCard}>
            <Text style={styles.upcomingName} numberOfLines={1}>{t.name || t.category_label || 'Transaction'}</Text>
            <Text style={styles.upcomingDate}>{t.date}</Text>
            <Text style={[styles.upcomingAmount, { color: t.type === 'expense' ? '#e74c3c' : '#27ae60' }]}>
            {t.type === 'expense' ? '-' : '+'}${Number(t.amount).toFixed(2)}
            </Text>
            </View>
        ))}
        </ScrollView>
        </View>
        </View>
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f6fa' },
    content: { padding: 16 },
    overviewRow: { flexDirection: 'row', gap: 12, marginBottom: 16, alignItems: 'flex-start' },
    trendCol: { flex: 1 },
    analysisRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
    leftCol: { flex: 5 },
    midCol: { flex: 4 },
    rightCol: { flex: 3 },
    periodRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' },
    periodGroup: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3, borderWidth: 0.5, borderColor: '#e0e0e0' },
    periodBtn: { paddingHorizontal: 6, paddingVertical: 2 },
    periodBtnText: { fontSize: 13, color: '#2980b9', fontWeight: '700' },
    periodText: { fontSize: 13, fontWeight: '600', color: '#2c3e50', minWidth: 40, textAlign: 'center' },
    toggleRow: { flexDirection: 'row', backgroundColor: '#f0f0f0', borderRadius: 8, padding: 2 },
    toggleBtn: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6 },
    toggleBtnActive: { backgroundColor: '#2c3e50' },
    toggleBtnText: { fontSize: 12, color: '#888', fontWeight: '500' },
    toggleBtnTextActive: { color: '#fff' },
    periodLabel: { fontSize: 12, color: '#2980b9', fontWeight: '600' },
    sectionTitle: { fontSize: 14, fontWeight: '600', color: '#1a1a1a', marginBottom: 8, marginTop: 0 },
    empty: { textAlign: 'center', color: '#888', marginTop: 8, marginBottom: 16, fontSize: 12 },
    upcomingCard: { backgroundColor: '#fff', borderRadius: 6, padding: 6, marginBottom: 3, borderWidth: 0.5, borderColor: '#e0e0e0' },
    upcomingName: { fontSize: 11, fontWeight: '500', color: '#1a1a1a' },
    upcomingDate: { fontSize: 10, color: '#888' },
    upcomingAmount: { fontSize: 11, fontWeight: '600' },
})