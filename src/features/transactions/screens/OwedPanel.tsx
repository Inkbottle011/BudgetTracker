import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Button } from '../../../shared/ui/ui'
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog'
import { useStyles, Palette, tabular } from '../../../shared/theme/theme'
import { formatMoney } from '../../../shared/money/format'
import { displayDate } from '../logic/listLogic'
import { supabase } from '../../../shared/supabase'
import { todayString } from '../../../shared/money/entry'
import { owedToYou, matchingPayments, SplitShare } from '../logic/splits'
import { useToastContext } from '../../../shared/ui/ToastContext'

interface Props {
    transactions: any[]
    /** Called after a payment is recorded, so the list can reload. */
    onChanged: () => void
}

const money = (n: number | string) => formatMoney(Number(n))

/** "Owed to you": who still has to pay you back for split expenses, and recording when they do. */
export function OwedPanel({ transactions, onChanged }: Props) {
    const { showToast } = useToastContext()
    const styles = useStyles(makeStyles)
    const today = todayString()
    const [shares, setShares] = useState<SplitShare[]>([])
    const [open, setOpen] = useState(false)
    const [busy, setBusy] = useState(false)
    const [forgetting, setForgetting] = useState<SplitShare | null>(null)

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
        showToast(`Forgot what ${share.person} owes`, 'success', {
            label: 'Undo',
            onPress: async () => {
                const { error: restoreError } = await supabase.from('split_shares').insert(share)
                if (restoreError) showToast(`Couldn't bring that back: ${restoreError.message}`, 'error')
                else showToast(`${share.person} owes you again`)
                await loadShares()
            },
        })
        await loadShares()
    }

    return (
        <View style={styles.box}>
            <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                style={styles.bar}
                onPress={() => setOpen(o => !o)}
            >
                <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.barText}>Owed to you: {money(owed.total)}</Text>
                    <Text style={styles.barHint} numberOfLines={open ? undefined : 1}>
                        {owed.byPerson.map(p => `${p.person} ${money(p.amount)}`).join(' · ')}
                    </Text>
                </View>
                <Text style={styles.toggle}>{open ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>

            {open && (
                <View accessibilityLabel="Owed to you" style={styles.panel}>
                    {owed.expenses.map(({ expense, unpaid, outstanding }) => (
                        <View key={expense.id} style={styles.expense}>
                            <Text style={styles.expenseTitle}>
                                {expense.name || 'Expense'} · {displayDate(expense.date, today)} · {money(expense.amount)}
                            </Text>
                            <Text style={styles.muted}>{money(outstanding)} still owed</Text>
                            {unpaid.map(share => {
                                const matches = matchingPayments(share, expense, transactions, shares).slice(0, 2)
                                return (
                                    <View key={share.id} style={styles.share}>
                                        <View style={styles.shareRow}>
                                            <Text style={styles.person}>{share.person}</Text>
                                            <Text style={[styles.amount, tabular]}>{money(share.amount)}</Text>
                                            <Button
                                                small
                                                variant="secondary"
                                                label="Paid"
                                                accessibilityLabel={`${share.person} paid`}
                                                onPress={() => markPaid(share, expense)}
                                                disabled={busy}
                                            />
                                            <Button
                                                small
                                                variant="ghost"
                                                label="Forget"
                                                accessibilityLabel={`Forget what ${share.person} owes`}
                                                onPress={() => setForgetting(share)}
                                                disabled={busy}
                                            />
                                        </View>
                                        {matches.map(m => (
                                            <TouchableOpacity
                                                key={m.id}
                                                accessibilityRole="button"
                                                accessibilityLabel={`Use ${m.name || 'payment'} on ${m.date} for ${share.person}`}
                                                onPress={() => useExisting(share, expense, m)}
                                                disabled={busy}
                                            >
                                                <Text style={styles.match}>
                                                    Already in your transactions? Use "{m.name || 'payment'}" from {displayDate(m.date, today)}
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
            <ConfirmDialog
                visible={!!forgetting}
                title={`Forget what ${forgetting?.person} owes?`}
                message={`The ${money(forgetting?.amount ?? 0)} ${forgetting?.person} owes you won't be tracked any more. You can undo it straight after.`}
                confirmLabel="Forget"
                onCancel={() => setForgetting(null)}
                onConfirm={() => { const share = forgetting!; setForgetting(null); forget(share) }}
            />
        </View>
    )
}

const makeStyles = (C: Palette) => StyleSheet.create({
    box: { backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.line, marginBottom: 16, overflow: 'hidden' },
    bar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14 },
    barText: { fontWeight: '700', color: C.ink, fontSize: 15 },
    barHint: { color: C.muted, fontSize: 13, marginTop: 2 },
    toggle: { color: C.primary, fontWeight: '600', fontSize: 14 },
    panel: { borderTopWidth: 1, borderColor: C.line, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
    expense: { marginBottom: 12 },
    expenseTitle: { fontSize: 14, fontWeight: '600', color: C.ink },
    muted: { fontSize: 12, color: C.muted, marginTop: 2, marginBottom: 4 },
    share: { paddingVertical: 6, borderTopWidth: 1, borderColor: C.line },
    shareRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    person: { flex: 1, fontSize: 14, color: C.text },
    amount: { fontSize: 14, fontWeight: '600', color: C.ink },
    match: { fontSize: 12, color: C.primary, marginTop: 4, lineHeight: 17 },
})
