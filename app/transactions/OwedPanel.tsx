import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { supabase } from '../../lib/supabase'
import { todayString } from '../../lib/entry'
import { owedToYou, matchingPayments, SplitShare } from '../../lib/splits'
import { useToastContext } from '../../context/ToastContext'

interface Props {
    transactions: any[]
    /** Called after a payment is recorded, so the list can reload. */
    onChanged: () => void
}

const money = (n: number | string) => `$${Number(n).toFixed(2)}`

/** "Owed to you": who still has to pay you back for split expenses, and recording when they do. */
export function OwedPanel({ transactions, onChanged }: Props) {
    const { showToast } = useToastContext()
    const [shares, setShares] = useState<SplitShare[]>([])
    const [open, setOpen] = useState(false)
    const [busy, setBusy] = useState(false)

    async function loadShares() {
        const { data, error } = await supabase.from('split_shares').select('*')
        if (!error && data) setShares(data as SplitShare[])
    }

    // Reload when transactions change (a split expense was just added, or a payment recorded)
    useEffect(() => { loadShares() }, [transactions])

    const owed = owedToYou(shares, transactions)
    if (owed.total === 0) return null

    async function settle(share: SplitShare, paymentId: string) {
        const { error } = await supabase.from('split_shares').update({ settled_by: paymentId }).eq('id', share.id)
        if (error) { showToast(`Couldn't mark ${share.person} as paid: ${error.message}`, 'error'); return false }
        return true
    }

    /** Record a new payback for this person's share, dated today. */
    async function markPaid(share: SplitShare, expense: any) {
        setBusy(true)
        const { data: { session } } = await supabase.auth.getSession()
        const { data, error } = await supabase.from('transactions').insert({
            user_id: session?.user.id,
            type: 'reimbursement',
            amount: Number(share.amount),
            name: `${share.person} paid back`,
            note: `For ${expense.name || 'expense'}`,
            category_label: expense.category_label || '',
            category_id: null,
            date: todayString(),
            reimburses_id: expense.id,
        }).select('id').single()
        if (error || !data) {
            showToast(`Couldn't record that payment: ${error?.message ?? 'unknown error'}`, 'error')
        } else if (await settle(share, data.id)) {
            showToast(`${share.person} paid you back ${money(share.amount)}`)
            await loadShares()
            onChanged()
        }
        setBusy(false)
    }

    /** Use money already in your transactions (e.g. an imported Venmo deposit) as this person's payback. */
    async function useExisting(share: SplitShare, expense: any, payment: any) {
        setBusy(true)
        const { error } = await supabase.from('transactions')
            .update({ type: 'reimbursement', category_label: expense.category_label || '', reimburses_id: expense.id })
            .eq('id', payment.id)
        if (error) {
            showToast(`Couldn't use that payment: ${error.message}`, 'error')
        } else if (await settle(share, payment.id)) {
            showToast(`${share.person} paid you back ${money(share.amount)}`)
            await loadShares()
            onChanged()
        }
        setBusy(false)
    }

    async function forget(share: SplitShare) {
        const { error } = await supabase.from('split_shares').delete().eq('id', share.id)
        if (error) { showToast(`Couldn't remove that: ${error.message}`, 'error'); return }
        await loadShares()
    }

    return (
        <View style={styles.wrap}>
            <TouchableOpacity style={styles.bar} onPress={() => setOpen(o => !o)}>
                <Text style={styles.barText}>Owed to you: {money(owed.total)}</Text>
                <Text style={styles.barHint}>
                    {owed.byPerson.map(p => `${p.person} ${money(p.amount)}`).join(' · ')}  {open ? '▲' : '▼'}
                </Text>
            </TouchableOpacity>

            {open && (
                <View accessibilityLabel="Owed to you" style={styles.panel}>
                    {owed.expenses.map(({ expense, unpaid, outstanding }) => (
                        <View key={expense.id} style={styles.expense}>
                            <Text style={styles.expenseTitle}>
                                {expense.name || 'Expense'} · {expense.date} · {money(expense.amount)}
                                <Text style={styles.muted}>  ({money(outstanding)} still owed)</Text>
                            </Text>
                            {unpaid.map(share => {
                                const matches = matchingPayments(share, expense, transactions, shares).slice(0, 2)
                                return (
                                    <View key={share.id} style={styles.share}>
                                        <View style={styles.shareRow}>
                                            <Text style={styles.person}>{share.person}</Text>
                                            <Text style={styles.amount}>{money(share.amount)}</Text>
                                            <TouchableOpacity
                                                accessibilityLabel={`${share.person} paid`}
                                                style={styles.paidBtn}
                                                onPress={() => markPaid(share, expense)}
                                                disabled={busy}
                                            >
                                                <Text style={styles.paidText}>Paid</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                accessibilityLabel={`Forget what ${share.person} owes`}
                                                onPress={() => forget(share)}
                                                disabled={busy}
                                            >
                                                <Text style={styles.forget}>Forget</Text>
                                            </TouchableOpacity>
                                        </View>
                                        {matches.map(m => (
                                            <TouchableOpacity
                                                key={m.id}
                                                accessibilityLabel={`Use ${m.name || 'payment'} on ${m.date} for ${share.person}`}
                                                onPress={() => useExisting(share, expense, m)}
                                                disabled={busy}
                                            >
                                                <Text style={styles.match}>
                                                    Already in your transactions? Use "{m.name || 'payment'}" on {m.date}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )
                            })}
                        </View>
                    ))}
                </View>
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    wrap: { paddingHorizontal: 16, paddingTop: 12 },
    bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#e8f6f3', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
    barText: { fontWeight: '700', color: '#117864', fontSize: 13 },
    barHint: { color: '#117864', fontSize: 12, flexShrink: 1, textAlign: 'right', marginLeft: 8 },
    panel: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d5efe9', borderRadius: 8, marginTop: 6, padding: 10 },
    expense: { marginBottom: 10 },
    expenseTitle: { fontSize: 13, fontWeight: '600', color: '#2c3e50', marginBottom: 4 },
    muted: { fontWeight: '400', color: '#888' },
    share: { paddingVertical: 4, borderTopWidth: 0.5, borderColor: '#f0f0f0' },
    shareRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    person: { flex: 1, fontSize: 13, color: '#1a1a1a' },
    amount: { fontSize: 13, fontWeight: '600', color: '#117864' },
    paidBtn: { backgroundColor: '#16a085', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
    paidText: { color: '#fff', fontSize: 12, fontWeight: '600' },
    forget: { color: '#999', fontSize: 12 },
    match: { fontSize: 11, color: '#2980b9', marginTop: 4 },
})
