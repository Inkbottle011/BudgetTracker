import { useCallback, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { supabase } from '../lib/supabase'
import { fetchLinkedBanks, callBank, describeStatus, suggestedStartDate, accountLabel, LinkedBank } from '../lib/bank'
import { bankLinkingAvailable, openBankConnect } from '../lib/bankConnect'
import { parseDate, todayString } from '../lib/entry'
import { useToastContext } from '../context/ToastContext'
import { settingsCardStyles } from './TwoFactorSection'

/** Settings: link banks (Plaid by default), see their status, sync now, unlink. */
export function LinkedBanksSection({ twoFactorOn }: { twoFactorOn: boolean }) {
    const { showToast } = useToastContext()
    const [banks, setBanks] = useState<LinkedBank[]>([])
    const [loading, setLoading] = useState(false)
    const [busy, setBusy] = useState<string | null>(null)
    const [linking, setLinking] = useState(false)
    const [startDate, setStartDate] = useState('')
    const [confirmUnlink, setConfirmUnlink] = useState<string | null>(null)

    async function load() {
        if (!twoFactorOn) { setBanks([]); return }
        setLoading(true)
        try { setBanks(await fetchLinkedBanks()) } catch (e: any) { showToast(e?.message ?? "Couldn't load linked banks", 'error') }
        setLoading(false)
    }
    useFocusEffect(useCallback(() => { load() }, [twoFactorOn]))

    async function startLinking() {
        const { data } = await supabase.from('transactions').select('date').order('date', { ascending: false }).limit(1)
        setStartDate(suggestedStartDate(data ?? [], todayString()))
        setLinking(true)
    }

    async function continueToBank() {
        const syncFrom = parseDate(startDate)
        if (!syncFrom) { showToast('Pick a start date like 2026-10-01', 'error'); return }
        setBusy('link')
        try {
            const signIn = await openBankConnect()
            if (signIn) {
                const name = signIn.institutionName ?? 'Bank'
                const result = await callBank('link', signIn.publicToken
                    ? { publicToken: signIn.publicToken, institutionName: name, syncFrom }
                    : { accessToken: signIn.accessToken, enrollmentId: signIn.enrollmentId, institutionName: name, syncFrom })
                showToast(result?.status === 'pending'
                    ? `${name} linked. Its transactions are still loading; they'll appear at the next sync, or tap Sync now in a few minutes.`
                    : `${name} linked. Added ${result?.added ?? 0} transactions.`)
                setLinking(false)
                await load()
            }
        } catch (e: any) {
            showToast(e?.message ?? "Couldn't link that bank", 'error')
        }
        setBusy(null)
    }

    async function syncNow() {
        setBusy('sync')
        try {
            const result = await callBank('sync')
            const n = result?.added ?? 0
            showToast(n === 0 ? 'Up to date: no new transactions' : `Added ${n} new transaction${n === 1 ? '' : 's'}`)
            await load()
        } catch (e: any) {
            showToast(e?.message, 'error')
        }
        setBusy(null)
    }

    async function unlink(bank: LinkedBank) {
        setBusy(bank.id)
        try {
            await callBank('unlink', { connectionId: bank.id })
            showToast(`${bank.institution_name ?? 'Bank'} unlinked`)
            setConfirmUnlink(null)
            await load()
        } catch (e: any) {
            showToast(e?.message, 'error')
        }
        setBusy(null)
    }

    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <Text style={styles.title}>Linked banks</Text>
                {banks.length > 0 && (
                    <TouchableOpacity onPress={syncNow} disabled={!!busy}>
                        {busy === 'sync' ? <ActivityIndicator size="small" /> : <Text style={styles.link}>Sync now</Text>}
                    </TouchableOpacity>
                )}
            </View>
            <Text style={styles.help}>
                New transactions are added automatically every morning. Read-only: the app can see transactions but can't move money.
            </Text>

            {!twoFactorOn ? (
                <Text style={styles.notice}>Turn on two-factor sign-in above to link a bank.</Text>
            ) : (
                <>
                    {loading && <ActivityIndicator style={{ marginVertical: 8 }} />}
                    {banks.map(bank => (
                        <View key={bank.id} style={styles.bank}>
                            <View style={styles.bankTop}>
                                <Text style={styles.bankName}>{bank.institution_name ?? 'Bank'}</Text>
                                {confirmUnlink !== bank.id && (
                                    <TouchableOpacity onPress={() => setConfirmUnlink(bank.id)} disabled={!!busy}>
                                        <Text style={styles.unlink}>Unlink</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                            {bank.accounts.map(a => (
                                <Text key={a.id} style={styles.account}>{accountLabel(a)}</Text>
                            ))}
                            <Text style={[styles.status, bank.status !== 'active' && styles.statusBad]}>{describeStatus(bank)}</Text>
                            {confirmUnlink === bank.id && (
                                <View style={styles.confirm}>
                                    <Text style={styles.confirmText}>Unlink {bank.institution_name ?? 'this bank'}? Transactions already imported stay.</Text>
                                    <View style={styles.row}>
                                        <TouchableOpacity style={styles.danger} onPress={() => unlink(bank)} disabled={!!busy}>
                                            <Text style={styles.dangerText}>Yes, unlink</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => setConfirmUnlink(null)}><Text style={styles.link}>Cancel</Text></TouchableOpacity>
                                    </View>
                                </View>
                            )}
                        </View>
                    ))}

                    {!bankLinkingAvailable() ? (
                        <Text style={styles.notice}>Link banks from the website version of the app.</Text>
                    ) : linking ? (
                        <View style={styles.linkBox}>
                            <Text style={styles.label}>Import transactions from</Text>
                            <TextInput
                                accessibilityLabel="Import transactions from"
                                style={styles.dateInput}
                                value={startDate}
                                onChangeText={setStartDate}
                                placeholder="YYYY-MM-DD"
                                placeholderTextColor="#aaa"
                            />
                            <Text style={styles.small}>Starts the day after your latest transaction, so nothing is added twice.</Text>
                            <View style={styles.row}>
                                <TouchableOpacity style={styles.primary} onPress={continueToBank} disabled={!!busy}>
                                    {busy === 'link' ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryText}>Continue to your bank</Text>}
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setLinking(false)}><Text style={styles.link}>Cancel</Text></TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <TouchableOpacity style={styles.primary} onPress={startLinking} disabled={!!busy}>
                            <Text style={styles.primaryText}>+ Link a bank</Text>
                        </TouchableOpacity>
                    )}
                </>
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    ...settingsCardStyles,
    notice: { fontSize: 13, color: '#7f8c8d', fontStyle: 'italic' },
    bank: { borderTopWidth: 0.5, borderColor: '#eee', paddingVertical: 10 },
    bankTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    bankName: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
    unlink: { color: '#e74c3c', fontSize: 13, fontWeight: '600' },
    account: { fontSize: 13, color: '#555', marginTop: 2 },
    status: { fontSize: 12, color: '#1e8449', marginTop: 4 },
    statusBad: { color: '#c0392b' },
    linkBox: { gap: 6, marginTop: 8 },
    label: { fontSize: 13, fontWeight: '600', color: '#2c3e50' },
    dateInput: { backgroundColor: '#f8f9fa', borderRadius: 8, padding: 10, fontSize: 14, borderWidth: 1, borderColor: '#e8e8e8', width: 160, color: '#1a1a1a' },
    small: { fontSize: 12, color: '#999', marginBottom: 6 },
})
