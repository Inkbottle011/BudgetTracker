import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTransactionStore } from '../../store/useTransactionStore'

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
    const [view, setView] = useState<'month' | 'year'>('month')
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
    const [chartType, setChartType] = useState<'bar' | 'pie'>('bar')

    useEffect(() => { fetchAll() }, [selectedYear])

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

    // Balance
    const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const balance = income - expenses

    // Upcoming
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
        }
        return budgetAmounts.filter(a => a.budget_item_id === itemId).reduce((s, a) => s + a.amount, 0)
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

    // Spending by category data for charts
    function getSpendingByCategory() {
        const filtered = transactions.filter(t => {
            if (t.type !== 'expense') return false
            if (view === 'month') {
                const tMonth = new Date(t.date).getMonth() + 1
                const tYear = new Date(t.date).getFullYear()
                return tMonth === selectedMonth && tYear === selectedYear
            }
            return new Date(t.date).getFullYear() === selectedYear
        })

        const grouped: Record<string, number> = {}
        filtered.forEach(t => {
            const key = t.category_label || 'Other'
            grouped[key] = (grouped[key] || 0) + Number(t.amount)
        })

        return Object.entries(grouped)
            .map(([label, amount]) => ({ label, amount }))
            .sort((a, b) => b.amount - a.amount)
    }

    return {
        transactions, budgetItems, budgetAmounts,
        view, setView,
        selectedMonth, setSelectedMonth,
        selectedYear, setSelectedYear,
        chartType, setChartType,
        income, expenses, balance,
        upcoming,
        getPlanned, getActual,
        getSpendingByCategory,
    }
}