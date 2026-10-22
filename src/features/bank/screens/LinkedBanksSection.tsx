import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { supabase } from '../../../shared/supabase'
import {
    fetchLinkedBanks, callBank, describeStatus, suggestedStartDate, earliestStartDate, accountLabel, LinkedBank,
    fetchPossibleDuplicates, resolvePossibleDuplicate, reviewNote, PossibleDuplicate, DuplicateChoice,
} from '../logic/bank'
import { PossibleDuplicates } from './PossibleDuplicates'
import { bankLinkingAvailable, openBankConnect } from '../logic/bankConnect'
import { parseDate, todayString } from '../../../shared/money/entry'
import { useToastContext } from '../../../shared/ui/ToastContext'
import { useTheme, useStyles, Palette, tabular } from '../../../shared/theme/theme'
import { Section, Button, Field } from '../../../shared/ui/ui'
import { makeSettingsStyles } from '../../../shared/ui/settingsStyles'
import { latestTransactionDate } from '../../transactions/api'

/** Settings: link banks (Plaid by default), see their status, sync now, unlink. */
export function LinkedBanksSection({ twoFactorOn }: { twoFactorOn: boolean }) {
    const { c: C } = useTheme()
    const styles = useStyles(makeStyles)
    const { showToast } = useToastContext()
    const [banks, setBanks] = useState<LinkedBank[]>([])
    const [loading, setLoading] = useState(false)
    const [busy, setBusy] = useState<string | null>(null)
    const [linking, setLinking] = useState(false)
    const [startDate, setStartDate] = useState('')
    const [confirmUnlink, setConfirmUnlink] = useState<string | null>(null)
    const [duplicates, setDuplicates] = useState<PossibleDuplicate[]>([])

    async function load() {
        if (!twoFactorOn) { setBanks([]); setDuplicates([]); return }
        setLoading(true)
        try { setBanks(await fetchLinkedBanks()) } catch (e: any) { showToast(e?.message ?? "Couldn't load linked banks", 'error') }
        // Possible duplicates are a nice-to-have here: never block the bank list on them
        try { setDuplicates(await fetchPossibleDuplicates()) } catch { setDuplicates([]) }
        setLoading(false)
    }

    async function resolve(item: PossibleDuplicate, choice: DuplicateChoice) {
        setBusy(item.id)
        try {
            await resolvePossibleDuplicate(item.id, choice)
            setDuplicates(await fetchPossibleDuplicates())
        } catch (e: any) {
            showToast(e?.message ?? "Couldn't save that choice", 'error')
        }
        setBusy(null)
    }
    useFocusEffect(useCallback(() => { load() }, [twoFactorOn]))

    async function startLinking() {
        setStartDate(suggestedStartDate(await latestTransactionDate(), todayString()))
        setLinking(true)
    }

    async function continueToBank() {
        const syncFrom = parseDate(startDate)
        if (!syncFrom) { showToast('Pick a start date like 2026-10-01', 'error'); return }
        const earliest = earliestStartDate(todayString())
        if (syncFrom < earliest) { showToast(`Banks share history back to ${earliest}. Pick that date or later.`, 'error'); return }
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
                    : `${name} linked. Added ${result?.added ?? 0} transactions.${reviewNote(result?.toReview)}`)
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
            const added = n === 0 ? 'Up to date: no new transactions' : `Added ${n} new transaction${n === 1 ? '' : 's'}`
            showToast(`${added}${result?.toReview ? '.' : ''}${reviewNote(result?.toReview)}`)
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

    const syncButton = banks.length > 0
        ? <Button variant="secondary" small label="Sync now" onPress={syncNow} loading={busy === 'sync'} disabled={!!busy} />
        : undefined

    return (
        <Section title="Linked banks" action={syncButton}>
            <Text style={styles.help}>
                New transactions are added automatically every morning. Read-only: the app can see transactions but can't move money.
            </Text>

            {!twoFactorOn ? (
                <Text style={styles.notice}>Turn on two-factor sign-in above to link a bank.</Text>
            ) : (
                <>
                    {loading && <ActivityIndicator color={C.primary} style={{ marginVertical: 8 }} />}
                    {banks.map(bank => (
                        <View key={bank.id} style={styles.bank}>
                            <View style={styles.bankTop}>
                                <Text style={styles.bankName}>{bank.institution_name ?? 'Bank'}</Text>
                                {confirmUnlink !== bank.id && (
                                    <Button variant="ghost" small label="Unlink" onPress={() => setConfirmUnlink(bank.id)} disabled={!!busy} />
                                )}
                            </View>
                            {bank.accounts.map(a => (
                                <Text key={a.id} style={styles.account}>{accountLabel(a)}</Text>
                            ))}
                            <Text style={[styles.status, bank.status !== 'active' && styles.statusBad]}>{describeStatus(bank)}</Text>
                            {confirmUnlink === bank.id && (
                                <View style={[styles.confirm, { marginTop: 10 }]}>
                                    <Text style={styles.confirmText}>Unlink {bank.institution_name ?? 'this bank'}? Transactions already imported stay. This can't be undone: to sync it again you'd link it again.</Text>
                                    <View style={styles.row}>
                                        <Button variant="danger" small label="Yes, unlink" onPress={() => unlink(bank)} loading={busy === bank.id} disabled={!!busy} />
                                        <Button variant="ghost" small label="Cancel" onPress={() => setConfirmUnlink(null)} />
                                    </View>
                                </View>
                            )}
                        </View>
                    ))}

                    <PossibleDuplicates items={duplicates} busyId={busy} onResolve={resolve} />

                    {!bankLinkingAvailable() ? (
                        <Text style={styles.notice}>Link banks from the website version of the app.</Text>
                    ) : linking ? (
                        <View style={styles.linkBox}>
                            <View style={styles.dateField}>
                                <Field
                                    label="Import transactions from"
                                    value={startDate}
                                    onChangeText={setStartDate}
                                    placeholder="YYYY-MM-DD"
                                    autoCapitalize="none"
                                />
                            </View>
                            <Text style={styles.small}>
                                Starts the day after your latest transaction. Banks share history back to Jan 1. If you go back further than
                                your latest transaction, ones you already have are matched and skipped, and any we're unsure about are shown
                                here for you to check.
                            </Text>
                            <View style={styles.row}>
                                <Button label="Continue to your bank" onPress={continueToBank} loading={busy === 'link'} disabled={!!busy} />
                                <Button variant="ghost" label="Cancel" onPress={() => setLinking(false)} />
                            </View>
                        </View>
                    ) : (
                        <Button label="Link a bank" onPress={startLinking} disabled={!!busy} style={styles.start} />
                    )}
                </>
            )}
        </Section>
    )
}

const makeStyles = (C: Palette) => StyleSheet.create({
    ...makeSettingsStyles(C),
    bank: { borderTopWidth: 1, borderColor: C.line, paddingVertical: 12 },
    bankTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
    bankName: { fontSize: 15, fontWeight: '600', color: C.ink, flexShrink: 1 },
    account: { fontSize: 13, color: C.text, marginTop: 2, ...tabular },
    status: { fontSize: 12, color: C.good, marginTop: 4 },
    statusBad: { color: C.bad },
    linkBox: { marginTop: 8, borderTopWidth: 1, borderColor: C.line, paddingTop: 14 },
    dateField: { maxWidth: 220 },
    small: { fontSize: 13, color: C.muted, lineHeight: 18, marginTop: -4, marginBottom: 14 },
})
