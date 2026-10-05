import { useState, useCallback } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { supabase } from '../../lib/supabase'
import { useTransactionStore } from '../../store/useTransactionStore'
import { useToastContext } from '../../context/ToastContext'
import {
    Subscription, fetchSubscriptions, syncSubscriptionCharges, localToday, addDays, monthlyAmount, hasEnded, nextCharge,
} from '../../lib/subscriptions'

export interface SubscriptionDraft {
    id?: string
    type: string            // 'Income' | 'Expense' | 'Savings' | 'Investment'
    name: string
    amount: string
    category: string
    frequency: Subscription['frequency']
    startDate: string
    endDate: string
    note: string
}

export function emptyDraft(): SubscriptionDraft {
    return { type: 'Expense', name: '', amount: '', category: '', frequency: 'monthly', startDate: localToday(), endDate: '', note: '' }
}

export function draftFrom(s: Subscription): SubscriptionDraft {
    return {
        id: s.id,
        type: s.type.charAt(0).toUpperCase() + s.type.slice(1),
        name: s.name,
        amount: String(s.amount),
        category: s.category_label || '',
        frequency: s.frequency,
        startDate: s.start_date,
        endDate: s.end_date || '',
        note: s.note || '',
    }
}

export function useSubscriptions() {
    const { setTransactions } = useTransactionStore()
    const { showToast } = useToastContext()
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [budgetCategories, setBudgetCategories] = useState<Record<string, string[]>>({
        Income: [], Expense: [], Savings: [], Investment: [],
    })

    async function load() {
        try {
            setSubscriptions(await fetchSubscriptions())
            setLoadError(null)
        } catch (e: any) {
            setLoadError(e?.message || 'Could not load subscriptions')
        }
        setLoading(false)
    }

    // Other tabs read transactions from the shared store, so refresh it after charges are added
    async function refreshTransactions() {
        const { data } = await supabase.from('transactions').select('*').order('date', { ascending: false })
        if (data) setTransactions(data)
    }

    async function syncAndReload() {
        const added = await syncSubscriptionCharges()
        await load()
        if (added > 0) {
            await refreshTransactions()
            showToast(`Added ${added} charge${added > 1 ? 's' : ''} to your transactions`)
        }
    }

    async function loadCategories() {
        const { data } = await supabase.from('budget_items').select('name, type').order('created_at')
        if (!data) return
        const grouped: Record<string, string[]> = { Income: [], Expense: [], Savings: [], Investment: [] }
        data.forEach(item => {
            const key = item.type.charAt(0).toUpperCase() + item.type.slice(1)
            if (grouped[key]) grouped[key].push(item.name)
        })
        setBudgetCategories(grouped)
    }

    useFocusEffect(useCallback(() => {
        load()
        loadCategories()
    }, []))

    async function save(draft: SubscriptionDraft): Promise<boolean> {
        const row = {
            name: draft.name.trim(),
            amount: parseFloat(draft.amount),
            type: draft.type.toLowerCase(),
            category_label: draft.category || null,
            note: draft.note.trim() || null,
            frequency: draft.frequency,
            start_date: draft.startDate,
            end_date: draft.endDate || null,
        }
        const { error } = draft.id
            ? await supabase.from('subscriptions').update(row).eq('id', draft.id)
            : await supabase.from('subscriptions').insert(row)
        if (error) {
            showToast(error.message || 'Could not save subscription', 'error')
            return false
        }
        showToast(draft.id ? 'Subscription updated' : 'Subscription added')
        await syncAndReload()
        return true
    }

    async function setStatus(sub: Subscription, status: Subscription['status']) {
        const changes: Partial<Subscription> = { status }
        // When resuming, skip the charges that would have happened while it was paused
        if (status === 'active' && sub.status !== 'active') {
            const yesterday = addDays(localToday(), -1)
            if (!sub.generated_through || sub.generated_through < yesterday) changes.generated_through = yesterday
            if (sub.end_date && sub.end_date < localToday()) changes.end_date = null
        }
        const { error } = await supabase.from('subscriptions').update(changes).eq('id', sub.id)
        if (error) { showToast('Could not update subscription', 'error'); return }
        showToast(status === 'active' ? 'Subscription resumed' : status === 'paused' ? 'Subscription paused' : 'Subscription cancelled')
        await syncAndReload()
    }

    async function remove(sub: Subscription) {
        const { error } = await supabase.from('subscriptions').delete().eq('id', sub.id)
        if (error) { showToast('Could not delete subscription', 'error'); return }
        showToast('Subscription deleted')
        await load()
    }

    const today = localToday()
    const active = subscriptions
        .filter(s => s.status === 'active' && !hasEnded(s, today))
        .sort((a, b) => (nextCharge(a) || '9999').localeCompare(nextCharge(b) || '9999'))
    const paused = subscriptions.filter(s => s.status === 'paused' && !hasEnded(s, today))
    const ended = subscriptions.filter(s => hasEnded(s, today))

    const monthlyOut = active.filter(s => s.type === 'expense').reduce((sum, s) => sum + monthlyAmount(s), 0)
    const monthlyIn = active.filter(s => s.type === 'income').reduce((sum, s) => sum + monthlyAmount(s), 0)

    return {
        loading, loadError, active, paused, ended, monthlyOut, monthlyIn, budgetCategories,
        save, setStatus, remove, reload: syncAndReload,
    }
}
