import { useState, useEffect } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { useTransactionStore } from '../store/useTransactionStore'
import { TransactionCard } from '../components/TransactionCard'
import { supabase } from '../lib/supabase'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function Dashboard() {
    const { transactions, setTransactions } = useTransactionStore()
    const [budgetItems, setBudgetItems] = useState<any[]>([])
    const [budgetAmounts, setBudgetAmounts] = useState<any[]>([])
    const [view, setView] = useState<'month' | 'year'>('month')
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
    
    useEffect(() => {
        fetchAll()
    }, [selectedYear])
    
    async function fetchAll() {
        const { data: txData } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })
        if (txData) setTransactions(txData)
            
        const { data: items } = await supabase
        .from('budget_items')
        .select('*')
        .order('created_at')
        if (items) setBudgetItems(items)
            
        const { data: amounts } = await supabase
        .from('budget_amounts')
        .select('*')
        .eq('year', selectedYear)
        if (amounts) setBudgetAmounts(amounts)
        }
    
    // Balance calculations
    const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const balance = income - expenses
    
    // Upcoming recurring transactions (next 30 days)
    const today = new Date()
    const in30 = new Date(today)
    in30.setDate(in30.getDate() + 30)
    const upcoming = transactions
    .filter(t => t.recurring && t.recurring !== 'none')
    .map(t => {
        const next = new Date(t.date)
        if (t.recurring === 'weekly') next.setDate(next.getDate() + 7)
            else if (t.recurring === 'biweekly') next.setDate(next.getDate() + 14)
                else if (t.recurring === 'monthly') next.setMonth(next.getMonth() + 1)
                    else if (t.recurring === 'yearly') next.setFullYear(next.getFullYear() + 1)
                        return { ...t, nextDate: next.toISOString().split('T')[0] }
    })
    .filter(t => new Date(t.nextDate) >= today && new Date(t.nextDate) <= in30)
    .sort((a, b) => a.nextDate.localeCompare(b.nextDate))
    
    // Actual vs Planned
    function getPlanned(itemId: string, month?: number): number {
        if (view === 'month') {
            const a = budgetAmounts.find(a => a.budget_item_id === itemId && a.month === month)
            return a ? a.amount : 0
        } else {
            return budgetAmounts
            .filter(a => a.budget_item_id === itemId)
            .reduce((s, a) => s + a.amount, 0)
        }
    }
    
    function getActual(itemName: string, itemType: string, month?: number): number {
        return transactions
        .filter(t => {
            const matchCat = t.category_label === itemName
            const matchType = t.type === itemType
            if (view === 'month') {
                const tMonth = new Date(t.date).getMonth() + 1
                const tYear = new Date(t.date).getFullYear()
                return matchCat && matchType && tMonth === month && tYear === selectedYear
            }
            return matchCat && matchType && new Date(t.date).getFullYear() === selectedYear
        })
        .reduce((s, t) => s + t.amount, 0)
    }
    
    const SECTION_COLORS: Record<string, any> = {
        income:     { header: '#2980b9', light: '#EBF5FB', text: '#1a5276' },
        expense:    { header: '#e74c3c', light: '#FDEDEC', text: '#922b21' },
        savings:    { header: '#27ae60', light: '#EAFAF1', text: '#1e8449' },
        investment: { header: '#8e44ad', light: '#F5EEF8', text: '#6c3483' },
    }
    
    function renderActualVsPlanned() {
        const types = ['income', 'expense', 'savings', 'investment']
        return types.map(type => {
            const items = budgetItems.filter(i => i.type === type)
            if (items.length === 0) return null
            const colors = SECTION_COLORS[type]
            const label = type.charAt(0).toUpperCase() + type.slice(1)
            
            return (
                <View key={type} style={[styles.avpSection, { borderColor: colors.header }]}>
                <View style={[styles.avpHeader, { backgroundColor: colors.header }]}>
                <Text style={styles.avpHeaderText}>{label}</Text>
                <Text style={styles.avpHeaderCol}>Planned</Text>
                <Text style={styles.avpHeaderCol}>Actual</Text>
                <Text style={styles.avpHeaderCol}>Diff</Text>
                </View>
                {items.map(item => {
                    const planned = getPlanned(item.id, selectedMonth)
                    const actual = getActual(item.name, item.type, selectedMonth)
                    const diff = planned - actual
                    const pct = planned > 0 ? Math.min(actual / planned, 1) : 0
                    const over = actual > planned && planned > 0
                    return (
                        <View key={item.id} style={[styles.avpRow, { backgroundColor: colors.light }]}>
                        <Text style={[styles.avpName, { color: colors.text }]}>{item.name}</Text>
                        <Text style={styles.avpCol}>${planned.toLocaleString()}</Text>
                        <Text style={styles.avpCol}>${actual.toLocaleString()}</Text>
                        <Text style={[styles.avpCol, { color: diff >= 0 ? '#27ae60' : '#e74c3c', fontWeight: '600' }]}>
                        {diff >= 0 ? '+' : ''}${diff.toLocaleString()}
                        </Text>
                        {planned > 0 && (
                            <View style={styles.progressBar}>
                            <View style={[styles.progressFill, {
                                width: `${pct * 100}%`,
                                backgroundColor: over ? '#e74c3c' : '#27ae60'
                            }]} />
                            </View>
                        )}
                        </View>
                    )
                })}
                </View>
            )
        })
    }
    
    return (
        <ScrollView style={styles.container}>
        <Text style={styles.heading}>Overview</Text>
        
        {/* Balance */}
        <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Total Balance</Text>
        <Text style={styles.balanceAmount}>${balance.toFixed(2)}</Text>
        </View>
        
        {/* Income / Expense summary */}
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
        
        {/* Actual vs Planned */}
        <Text style={styles.sectionTitle}>Actual vs Planned</Text>
        
        {/* View toggle */}
        <View style={styles.toggleRow}>
        <TouchableOpacity
        style={[styles.toggleBtn, view === 'month' && styles.toggleBtnActive]}
        onPress={() => setView('month')}
        >
        <Text style={[styles.toggleBtnText, view === 'month' && styles.toggleBtnTextActive]}>Monthly</Text>
        </TouchableOpacity>
        <TouchableOpacity
        style={[styles.toggleBtn, view === 'year' && styles.toggleBtnActive]}
        onPress={() => setView('year')}
        >
        <Text style={[styles.toggleBtnText, view === 'year' && styles.toggleBtnTextActive]}>Yearly</Text>
        </TouchableOpacity>
        </View>
        
        {/* Year/Month selector */}
        <View style={styles.periodRow}>
        <TouchableOpacity onPress={() => setSelectedYear(y => y - 1)} style={styles.periodBtn}>
        <Text style={styles.periodBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.periodText}>{selectedYear}</Text>
        <TouchableOpacity onPress={() => setSelectedYear(y => y + 1)} style={styles.periodBtn}>
        <Text style={styles.periodBtnText}>→</Text>
        </TouchableOpacity>
        {view === 'month' && (
            <>
            <View style={styles.periodDivider} />
            <TouchableOpacity onPress={() => setSelectedMonth(m => m === 1 ? 12 : m - 1)} style={styles.periodBtn}>
            <Text style={styles.periodBtnText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.periodText}>{MONTHS[selectedMonth - 1]}</Text>
            <TouchableOpacity onPress={() => setSelectedMonth(m => m === 12 ? 1 : m + 1)} style={styles.periodBtn}>
            <Text style={styles.periodBtnText}>→</Text>
            </TouchableOpacity>
            </>
        )}
        </View>
        
        {budgetItems.length === 0 ? (
            <Text style={styles.empty}>Add budget items to see actual vs planned.</Text>
        ) : (
            renderActualVsPlanned()
        )}
        
        {/* Side by side - Upcoming and Recent */}
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
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f6fa', padding: 20 },
    heading: { fontSize: 24, fontWeight: '700', color: '#1a1a1a', marginBottom: 16 },
    balanceCard: { backgroundColor: '#2c3e50', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 16 },
    balanceLabel: { fontSize: 14, color: '#95a5a6', marginBottom: 8 },
    balanceAmount: { fontSize: 36, fontWeight: '700', color: '#fff' },
    row: { flexDirection: 'row', gap: 12, marginBottom: 24 },
    summaryCard: { flex: 1, borderRadius: 12, padding: 16 },
    summaryLabel: { fontSize: 13, color: '#666', marginBottom: 4 },
    summaryAmount: { fontSize: 20, fontWeight: '600' },
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
    avpSection: { marginBottom: 16, borderRadius: 8, overflow: 'hidden', borderWidth: 1 },
    avpHeader: { flexDirection: 'row', padding: 8, paddingHorizontal: 12 },
    avpHeaderText: { flex: 1, color: '#fff', fontWeight: '700', fontSize: 13 },
    avpHeaderCol: { width: 70, color: '#fff', fontWeight: '600', fontSize: 12, textAlign: 'right' },
    avpRow: { padding: 10, paddingHorizontal: 12, borderTopWidth: 0.5, borderColor: '#ddd' },
    avpName: { fontSize: 13, fontWeight: '500', marginBottom: 4 },
    avpCol: { width: 70, fontSize: 12, textAlign: 'right', color: '#555' },
    progressBar: { height: 4, backgroundColor: '#e0e0e0', borderRadius: 2, marginTop: 6, overflow: 'hidden' },
    progressFill: { height: 4, borderRadius: 2 },
    upcomingCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 0.5, borderColor: '#e0e0e0' },
    upcomingLeft: { flex: 1 },
    upcomingName: { fontSize: 14, fontWeight: '500', color: '#1a1a1a' },
    upcomingDate: { fontSize: 12, color: '#888', marginTop: 2 },
    upcomingAmount: { fontSize: 15, fontWeight: '600' },
    sideRow: { flexDirection: 'row', gap: 16, marginTop: 8 },
    sideCol: { flex: 1, maxHeight: 400 },
})