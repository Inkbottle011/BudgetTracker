import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Modal } from 'react-native'
import { useSubscriptions, emptyDraft, draftFrom, shortDate, SubscriptionDraft } from '../logic/useSubscriptions'
import { SubscriptionForm } from './SubscriptionForm'
import { Subscription, FREQUENCY_SHORT, FREQUENCY_LABELS, nextCharge, localToday } from '../logic/subscriptions'
import { useTheme, useStyles, Palette, tabular } from '../../../shared/theme/theme'
import { Page, PageTitle, Section, Button, EmptyState, useIsWide } from '../../../shared/ui/ui'
import { formatMoney } from '../../../shared/money/format'

export default function SubscriptionsScreen() {
    const s = useSubscriptions()
    const wide = useIsWide()
    const { c: C } = useTheme()
    const styles = useStyles(makeStyles)
    const [editing, setEditing] = useState<SubscriptionDraft | null>(null)

    const total = s.active.length + s.paused.length + s.ended.length
    const edit = (sub: Subscription) => setEditing(draftFrom(sub))
    const close = () => setEditing(null)

    const form = editing && (
        <SubscriptionForm key={editing.id || 'new'} initial={editing} budgetCategories={s.budgetCategories} onSave={s.save} onCancel={close} />
    )

    let body
    if (s.loading) {
        body = <ActivityIndicator style={styles.spinner} color={C.primary} />
    } else if (s.loadError) {
        body = (
            <Section>
                <Text style={styles.errorText}>Couldn't load subscriptions: {s.loadError}</Text>
                <Button variant="ghost" label="Try again" onPress={s.reload} style={styles.retry} />
            </Section>
        )
    } else if (total === 0) {
        body = (
            <Section>
                <EmptyState title="No subscriptions yet" body="Add things that repeat, like Spotify or rent, and they'll be added to your transactions on their dates." />
            </Section>
        )
    } else {
        body = (
            <>
                <Section>
                    <View style={styles.summary}>
                        <SummaryFigure label="Per month" out={s.monthlyOut} income={s.monthlyIn} />
                        <SummaryFigure label="Per year" out={s.monthlyOut * 12} income={s.monthlyIn * 12} />
                    </View>
                </Section>
                <Group title="Active" subs={s.active} onEdit={edit} onStatus={s.setStatus} onDelete={s.remove} />
                <Group title="Paused" subs={s.paused} onEdit={edit} onStatus={s.setStatus} onDelete={s.remove} />
                <Group title="Ended" subs={s.ended} onEdit={edit} onStatus={s.setStatus} onDelete={s.remove} />
            </>
        )
    }

    return (
        <Page maxWidth={wide && editing ? 1180 : 820}>
            <PageTitle
                title="Subscriptions"
                subtitle="Repeating charges and income. Each one is added to your transactions on its date."
                actions={!editing ? <Button label="Add subscription" onPress={() => setEditing(emptyDraft())} /> : undefined}
            />
            {wide && editing ? (
                <View style={styles.columns}>
                    <View style={styles.listColumn}>{body}</View>
                    <Section style={styles.formColumn}>{form}</Section>
                </View>
            ) : (
                body
            )}
            {!wide && (
                <Modal visible={!!editing} animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
                    <ScrollView style={styles.sheet} contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
                        {form}
                    </ScrollView>
                </Modal>
            )}
        </Page>
    )
}

function SummaryFigure({ label, out, income }: { label: string; out: number; income: number }) {
    const styles = useStyles(makeStyles)
    return (
        <View style={styles.figure}>
            <Text style={styles.figureLabel}>{label}</Text>
            <Text style={[styles.figureValue, tabular]}>{formatMoney(out)}</Text>
            {income > 0 && <Text style={[styles.figureIncome, tabular]}>{formatMoney(income, { sign: true })} coming in</Text>}
        </View>
    )
}

interface GroupProps {
    title: string
    subs: Subscription[]
    onEdit: (s: Subscription) => void
    onStatus: (s: Subscription, status: Subscription['status']) => void
    onDelete: (s: Subscription) => void
}

function Group({ title, subs, ...actions }: GroupProps) {
    if (subs.length === 0) return null
    return (
        <Section title={`${title} (${subs.length})`}>
            {subs.map((sub, i) => <SubscriptionRow key={sub.id} sub={sub} first={i === 0} {...actions} />)}
        </Section>
    )
}

function SubscriptionRow({ sub, first, onEdit, onStatus, onDelete }: { sub: Subscription; first: boolean } & Omit<GroupProps, 'title' | 'subs'>) {
    const { c: C } = useTheme()
    const styles = useStyles(makeStyles)
    const [confirm, setConfirm] = useState<null | 'cancel' | 'delete'>(null)
    const typeLabel = sub.type.charAt(0).toUpperCase() + sub.type.slice(1)
    const next = nextCharge(sub)
    const today = localToday()
    const ended = sub.status === 'cancelled' || (!!sub.end_date && sub.end_date < today)

    let statusLine: string
    if (sub.status === 'paused') statusLine = 'Paused · no charges until resumed'
    else if (sub.status === 'cancelled') statusLine = 'Cancelled'
    else if (ended) statusLine = `Ended ${shortDate(sub.end_date!)}`
    else if (next) statusLine = next < today ? `Charge due ${shortDate(next)}` : `Next charge ${shortDate(next)}`
    else statusLine = 'No more charges'
    if (sub.end_date && !ended) statusLine += ` · ends ${shortDate(sub.end_date)}`

    return (
        <View style={[styles.row, !first && styles.rowBorder]}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Edit ${sub.name}`} onPress={() => onEdit(sub)} style={styles.rowMain}>
                <View style={styles.rowText}>
                    <Text style={[styles.name, ended && { color: C.muted }]} numberOfLines={1}>{sub.name}</Text>
                    <Text style={styles.meta} numberOfLines={1}>{[sub.category_label || typeLabel, FREQUENCY_LABELS[sub.frequency]].join(' · ')}</Text>
                    <Text style={styles.meta}>{statusLine}</Text>
                </View>
                <View style={styles.amountBox}>
                    <Text style={[styles.amount, tabular, sub.type === 'income' && { color: C.good }, ended && { color: C.muted }]}>{formatMoney(Number(sub.amount))}</Text>
                    <Text style={styles.per}>/ {FREQUENCY_SHORT[sub.frequency]}</Text>
                </View>
            </TouchableOpacity>

            {confirm ? (
                <View style={styles.actions}>
                    <Text style={styles.confirmText}>
                        {confirm === 'delete' ? 'Delete? Past charges stay in transactions.' : 'Cancel? No more charges will be added.'}
                    </Text>
                    <TextButton tone="bad" label={confirm === 'delete' ? 'Yes, delete' : 'Yes, cancel it'}
                        onPress={() => { setConfirm(null); confirm === 'delete' ? onDelete(sub) : onStatus(sub, 'cancelled') }} />
                    <TextButton label="Keep it" onPress={() => setConfirm(null)} />
                </View>
            ) : (
                <View style={styles.actions}>
                    {sub.status === 'active' && !ended && <TextButton label="Pause" a11y={`Pause ${sub.name}`} onPress={() => onStatus(sub, 'paused')} />}
                    {(sub.status !== 'active' || ended) && <TextButton label="Resume" a11y={`Resume ${sub.name}`} onPress={() => onStatus(sub, 'active')} />}
                    {!ended && <TextButton label="Cancel" a11y={`Cancel ${sub.name}`} onPress={() => setConfirm('cancel')} />}
                    <TextButton tone="bad" label="Delete" a11y={`Delete ${sub.name}`} onPress={() => setConfirm('delete')} />
                </View>
            )}
        </View>
    )
}

/** A small, quiet text button for secondary actions. */
function TextButton({ label, a11y, onPress, tone }: { label: string; a11y?: string; onPress: () => void; tone?: 'bad' }) {
    const { c: C } = useTheme()
    const styles = useStyles(makeStyles)
    return (
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={a11y ?? label} onPress={onPress} style={styles.textBtn} hitSlop={6}>
            <Text style={[styles.textBtnLabel, { color: tone === 'bad' ? C.bad : C.primary }]}>{label}</Text>
        </TouchableOpacity>
    )
}

const makeStyles = (C: Palette) => StyleSheet.create({
    spinner: { marginTop: 24 },
    errorText: { color: C.bad, fontSize: 14, textAlign: 'center' },
    retry: { alignSelf: 'center', marginTop: 6 },

    columns: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
    listColumn: { flex: 1, minWidth: 0 },
    formColumn: { width: 400 },
    sheet: { flex: 1, backgroundColor: C.surface },
    sheetContent: { padding: 16, paddingTop: 24, paddingBottom: 40 },

    summary: { flexDirection: 'row', gap: 16 },
    figure: { flex: 1 },
    figureLabel: { fontSize: 13, color: C.muted, fontWeight: '600' },
    figureValue: { fontSize: 24, fontWeight: '700', color: C.ink, marginTop: 2 },
    figureIncome: { fontSize: 13, color: C.good, fontWeight: '600', marginTop: 2 },

    row: { paddingVertical: 12 },
    rowBorder: { borderTopWidth: 1, borderColor: C.line },
    rowMain: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    rowText: { flex: 1, minWidth: 0 },
    name: { fontSize: 15, fontWeight: '600', color: C.ink },
    meta: { fontSize: 13, color: C.muted, marginTop: 2 },
    amountBox: { alignItems: 'flex-end' },
    amount: { fontSize: 15, fontWeight: '700', color: C.ink },
    per: { fontSize: 12, color: C.muted, marginTop: 2 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 16, rowGap: 4, marginTop: 8 },
    textBtn: { paddingVertical: 4 },
    textBtnLabel: { fontSize: 13, fontWeight: '600' },
    confirmText: { fontSize: 13, color: C.text, flexBasis: '100%' },
})
