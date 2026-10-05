import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useSubscriptions, emptyDraft, draftFrom, SubscriptionDraft } from './useSubscriptions'
import { SubscriptionForm } from './SubscriptionForm'
import { TYPE_COLORS } from '../transactions/types'
import { Subscription, FREQUENCY_SHORT, nextCharge, formatDate, localToday } from '../../lib/subscriptions'

function money(n: number) {
    return `$${n.toFixed(2)}`
}

export default function SubscriptionsScreen() {
    const s = useSubscriptions()
    const [editing, setEditing] = useState<SubscriptionDraft | null>(null)

    const total = s.active.length + s.paused.length + s.ended.length

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
        <Text style={styles.heading}>Subscriptions</Text>
        {!editing && (
            <TouchableOpacity style={styles.addBtn} onPress={() => setEditing(emptyDraft())}>
            <Text style={styles.addBtnText}>+ Add</Text>
            </TouchableOpacity>
        )}
        </View>
        <Text style={styles.sub}>Repeating charges and income. Each one is added to your transactions on its date.</Text>

        <View style={styles.summaryRow}>
        <SummaryCard label="Spending per month" value={money(s.monthlyOut)} color="#e74c3c" />
        <SummaryCard label="Per year" value={money(s.monthlyOut * 12)} color="#e74c3c" />
        {s.monthlyIn > 0 && <SummaryCard label="Income per month" value={money(s.monthlyIn)} color="#27ae60" />}
        </View>

        {editing && (
            <SubscriptionForm
            key={editing.id || 'new'}
            initial={editing}
            budgetCategories={s.budgetCategories}
            onSave={s.save}
            onCancel={() => setEditing(null)}
            />
        )}

        {s.loading ? (
            <ActivityIndicator style={{ marginTop: 24 }} color="#2c3e50" />
        ) : s.loadError ? (
            <View style={styles.errorBox}>
            <Text style={styles.errorText}>Couldn't load subscriptions: {s.loadError}</Text>
            <TouchableOpacity onPress={s.reload}><Text style={styles.link}>Try again</Text></TouchableOpacity>
            </View>
        ) : total === 0 && !editing ? (
            <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No subscriptions yet</Text>
            <Text style={styles.emptyText}>Add things like Netflix, rent or your paycheck, and they'll be added to your transactions automatically.</Text>
            </View>
        ) : (
            <>
            <Section title="Active" subs={s.active} onEdit={sub => setEditing(draftFrom(sub))} onStatus={s.setStatus} onDelete={s.remove} />
            <Section title="Paused" subs={s.paused} onEdit={sub => setEditing(draftFrom(sub))} onStatus={s.setStatus} onDelete={s.remove} />
            <Section title="Ended" subs={s.ended} onEdit={sub => setEditing(draftFrom(sub))} onStatus={s.setStatus} onDelete={s.remove} />
            </>
        )}
        </ScrollView>
    )
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>{label}</Text>
        <Text style={[styles.summaryValue, { color }]}>{value}</Text>
        </View>
    )
}

interface SectionProps {
    title: string
    subs: Subscription[]
    onEdit: (s: Subscription) => void
    onStatus: (s: Subscription, status: Subscription['status']) => void
    onDelete: (s: Subscription) => void
}

function Section({ title, subs, ...actions }: SectionProps) {
    if (subs.length === 0) return null
    return (
        <View style={{ marginTop: 8 }}>
        <Text style={styles.sectionTitle}>{title} · {subs.length}</Text>
        {subs.map(sub => <SubscriptionCard key={sub.id} sub={sub} {...actions} />)}
        </View>
    )
}

function SubscriptionCard({ sub, onEdit, onStatus, onDelete }: { sub: Subscription } & Omit<SectionProps, 'title' | 'subs'>) {
    const [confirm, setConfirm] = useState<null | 'cancel' | 'delete'>(null)
    const typeKey = sub.type.charAt(0).toUpperCase() + sub.type.slice(1)
    const color = TYPE_COLORS[typeKey]?.bg || '#888'
    const next = nextCharge(sub)
    const today = localToday()
    const ended = sub.status === 'cancelled' || (!!sub.end_date && sub.end_date < today)

    let statusLine: string
    if (sub.status === 'paused') statusLine = 'Paused · no charges until resumed'
    else if (sub.status === 'cancelled') statusLine = 'Cancelled'
    else if (ended) statusLine = `Ended ${formatDate(sub.end_date!)}`
    else if (next) statusLine = next < today ? `Charge due ${formatDate(next)}` : `Next charge ${formatDate(next)}`
    else statusLine = 'No more charges'

    return (
        <View style={[styles.card, ended && { opacity: 0.7 }]}>
        <View style={[styles.stripe, { backgroundColor: color }]} />
        <View style={{ flex: 1 }}>
        <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
        <Text style={styles.cardName} numberOfLines={1}>{sub.name}</Text>
        <Text style={styles.cardMeta} numberOfLines={1}>{[typeKey, sub.category_label].filter(Boolean).join(' · ')}</Text>
        </View>
        <Text style={[styles.cardAmount, { color: sub.type === 'expense' ? '#e74c3c' : '#27ae60' }]}>
        {money(Number(sub.amount))}<Text style={styles.per}> / {FREQUENCY_SHORT[sub.frequency]}</Text>
        </Text>
        </View>
        <Text style={styles.statusLine}>{statusLine}{sub.end_date && !ended ? ` · ends ${formatDate(sub.end_date)}` : ''}</Text>

        {confirm ? (
            <View style={styles.actions}>
            <Text style={styles.confirmText}>
            {confirm === 'delete' ? 'Delete? Past charges stay in transactions.' : 'Cancel? No more charges will be added.'}
            </Text>
            <TouchableOpacity style={[styles.actionBtn, styles.dangerBtn]} onPress={() => { setConfirm(null); confirm === 'delete' ? onDelete(sub) : onStatus(sub, 'cancelled') }}>
            <Text style={styles.dangerText}>Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => setConfirm(null)}>
            <Text style={styles.actionText}>No</Text>
            </TouchableOpacity>
            </View>
        ) : (
            <View style={styles.actions}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => onEdit(sub)}>
            <Text style={styles.actionText}>Edit</Text>
            </TouchableOpacity>
            {sub.status === 'active' && !ended && (
                <TouchableOpacity style={styles.actionBtn} onPress={() => onStatus(sub, 'paused')}>
                <Text style={styles.actionText}>Pause</Text>
                </TouchableOpacity>
            )}
            {(sub.status !== 'active' || ended) && (
                <TouchableOpacity style={styles.actionBtn} onPress={() => onStatus(sub, 'active')}>
                <Text style={styles.actionText}>Resume</Text>
                </TouchableOpacity>
            )}
            {!ended && (
                <TouchableOpacity style={styles.actionBtn} onPress={() => setConfirm('cancel')}>
                <Text style={styles.actionText}>Cancel</Text>
                </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.actionBtn} onPress={() => setConfirm('delete')}>
            <Text style={styles.dangerText}>Delete</Text>
            </TouchableOpacity>
            </View>
        )}
        </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f6fa' },
    content: { padding: 16, paddingBottom: 40, maxWidth: 760, width: '100%', alignSelf: 'center' },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    heading: { fontSize: 24, fontWeight: '700', color: '#1a1a1a' },
    sub: { fontSize: 13, color: '#888', marginTop: 4, marginBottom: 16 },
    addBtn: { backgroundColor: '#2c3e50', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
    addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
    summaryCard: { flexGrow: 1, flexBasis: 140, backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: '#e0e0e0' },
    summaryLabel: { fontSize: 12, color: '#888', marginBottom: 4 },
    summaryValue: { fontSize: 20, fontWeight: '700' },
    sectionTitle: { fontSize: 13, fontWeight: '700', color: '#7f8c8d', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 8 },
    card: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, marginBottom: 10, borderWidth: 0.5, borderColor: '#e0e0e0', overflow: 'hidden', paddingRight: 14, paddingVertical: 12 },
    stripe: { width: 4, marginRight: 12, borderRadius: 2, marginLeft: 0 },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    cardName: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
    cardMeta: { fontSize: 12, color: '#888', marginTop: 2 },
    cardAmount: { fontSize: 16, fontWeight: '700' },
    per: { fontSize: 12, fontWeight: '500', color: '#888' },
    statusLine: { fontSize: 12, color: '#555', marginTop: 8 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 10 },
    actionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#f8f9fa' },
    actionText: { fontSize: 12, color: '#2c3e50', fontWeight: '600' },
    dangerBtn: { backgroundColor: '#fdedec', borderColor: '#f5b7b1' },
    dangerText: { fontSize: 12, color: '#e74c3c', fontWeight: '600' },
    confirmText: { fontSize: 12, color: '#555', flexBasis: '100%', marginBottom: 2 },
    emptyBox: { backgroundColor: '#fff', borderRadius: 12, padding: 24, alignItems: 'center', borderWidth: 0.5, borderColor: '#e0e0e0' },
    emptyTitle: { fontSize: 16, fontWeight: '600', color: '#1a1a1a', marginBottom: 6 },
    emptyText: { fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 19 },
    errorBox: { backgroundColor: '#fdedec', borderRadius: 8, padding: 12, alignItems: 'center', gap: 6 },
    errorText: { color: '#e74c3c', fontSize: 13, textAlign: 'center' },
    link: { color: '#3498db', fontWeight: '600', fontSize: 13 },
})
