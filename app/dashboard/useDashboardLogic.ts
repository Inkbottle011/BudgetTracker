import { useState, useCallback } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { supabase } from '../../lib/supabase'
import { useTransactionStore } from '../../store/useTransactionStore'
import { Subscription, fetchSubscriptions, upcomingCharges } from '../../lib/subscriptions'

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const SECTION_COLORS: Record<string, any> = {
    income:     { header: '#2980b9', light: '#EBF5FB', text: '#1a5276' },
    expense:    { header: '#e74c3c', light: '#FDEDEC', text: '#922b21' },
    savings:    { header: '#27ae60', light: '#EAFAF1', text: '#1e8449' },
    investment: { header: '#8e44ad', light: '#F5EEF8', text: '#6c3483' },
}

export function useDashboardLogic() {
    const { transactions, setTransactions } = useTransactionStore()
    const [budgetItems, setBudgetItems] = useState<any[]>([])
    const [budgetAmounts, setBudgetAmounts] = useState<any[]>([])
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
    
    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().getMonth() + 1
    
    // Analysis period selector
    const [view, setView] = useState<'month' | 'year'>('year')
    const [selectedMonth, setSelectedMonth] = useState(currentMonth)
    const [selectedYear, setSelectedYear] = useState(currentYear)
    const [chartType, setChartType] = useState<'bar' | 'pie'>('bar')
    
    // Refresh whenever the tab is opened, so changes made on other tabs show up
    useFocusEffect(useCallback(() => { fetchAll() }, [selectedYear]))
    
    async function fetchAll() {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        
        const { data: txData } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })
        if (txData) setTransactions(txData)
        
        fetchSubscriptions().then(setSubscriptions).catch(() => {})
            
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
    
    // Overview — always current year
    const yearTransactions = transactions.filter(t => new Date(t.date).getFullYear() === currentYear)
    const overviewIncome = yearTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const overviewExpenses = yearTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const overviewSavings = yearTransactions.filter(t => t.type === 'savings').reduce((s, t) => s + t.amount, 0)
    
    // All-time balance
    const balance = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    - transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    
    // Analysis period filter
    function filterForPeriod(t: any): boolean {
        const d = new Date(t.date)
        if (view === 'year') return d.getFullYear() === selectedYear
        return d.getFullYear() === selectedYear && d.getMonth() + 1 === selectedMonth
    }
    
    const periodTransactions = transactions.filter(filterForPeriod)
    const period = view === 'year' ? String(selectedYear) : `${MONTHS[selectedMonth - 1]} ${selectedYear}`
    
    // Upcoming: subscription charges in the next 30 days
    const upcoming = upcomingCharges(subscriptions, 30)
    
    function getPlanned(itemId: string): number {
        if (view === 'month') {
            const a = budgetAmounts.find(a => a.budget_item_id === itemId && a.month === selectedMonth)
            return a ? a.amount : 0
        }
        return budgetAmounts.filter(a => a.budget_item_id === itemId).reduce((s, a) => s + a.amount, 0)
    }
    
    function getActual(itemName: string, itemType: string): number {
        return periodTransactions
        .filter(t => t.category_label === itemName && t.type === itemType)
        .reduce((s, t) => s + t.amount, 0)
    }
    
    function getSpendingByCategory() {
        const grouped: Record<string, number> = {}
        periodTransactions.filter(t => t.type === 'expense').forEach(t => {
            const key = t.category_label || 'Other'
            grouped[key] = (grouped[key] || 0) + Number(t.amount)
        })
        return Object.entries(grouped)
        .map(([label, amount]) => ({ label, amount }))
        .sort((a, b) => b.amount - a.amount)
    }
    
    return {
        transactions, budgetItems, budgetAmounts,
        currentYear,
        balance, overviewIncome, overviewExpenses, overviewSavings,
        view, setView,
        selectedMonth, setSelectedMonth,
        selectedYear, setSelectedYear,
        period, chartType, setChartType,
        upcoming, periodTransactions,
        getPlanned, getActual, getSpendingByCategory,
    }
}