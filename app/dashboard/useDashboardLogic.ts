import { useState, useCallback } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { supabase } from '../../lib/supabase'
import { useTransactionStore } from '../../store/useTransactionStore'
import { Subscription, fetchSubscriptions, upcomingCharges } from '../../lib/subscriptions'
import {
    MONTHS, inPeriod, overview, plannedAmount, actualAmount, spendingByCategory, periodLabel,
} from './calculations'

export { MONTHS }

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
    
    // Overview: always the current year; balance is all-time
    const { income: overviewIncome, expenses: overviewExpenses, savings: overviewSavings, balance } = overview(transactions, currentYear)
    
    // Analysis period
    const periodTransactions = transactions.filter(t => inPeriod(t, view, selectedYear, selectedMonth))
    const period = periodLabel(view, selectedYear, selectedMonth)
    
    // Upcoming: subscription charges in the next 30 days
    const upcoming = upcomingCharges(subscriptions, 30)
    
    const getPlanned = (itemId: string) => plannedAmount(budgetAmounts, itemId, view, selectedMonth)
    const getActual = (itemName: string, itemType: string) => actualAmount(periodTransactions, itemName, itemType)
    const getSpendingByCategory = () => spendingByCategory(periodTransactions)
    
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