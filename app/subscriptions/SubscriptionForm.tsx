import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { TYPES, TYPE_COLORS, DEFAULT_CATEGORIES } from '../transactions/types'
import { FREQUENCIES, FREQUENCY_LABELS, isValidDate, localToday, formatDate, occurrence } from '../../lib/subscriptions'
import { SubscriptionDraft } from './useSubscriptions'

interface Props {
    initial: SubscriptionDraft
    budgetCategories: Record<string, string[]>
    onSave: (d: SubscriptionDraft) => Promise<boolean>
    onCancel: () => void
}

type Errors = Partial<Record<'name' | 'amount' | 'startDate' | 'endDate', string>>

export function SubscriptionForm({ initial, budgetCategories, onSave, onCancel }: Props) {
    const [draft, setDraft] = useState<SubscriptionDraft>(initial)
    const [errors, setErrors] = useState<Errors>({})
    const [saving, setSaving] = useState(false)
    const isEditing = !!initial.id
    const color = TYPE_COLORS[draft.type]?.bg || '#2c3e50'
    const categories = budgetCategories[draft.type]?.length ? budgetCategories[draft.type] : DEFAULT_CATEGORIES[draft.type]

    function set<K extends keyof SubscriptionDraft>(key: K, value: SubscriptionDraft[K]) {
        setDraft(d => ({ ...d, [key]: value }))
        setErrors(e => ({ ...e, [key]: undefined }))
    }

    function validate(): boolean {
        const e: Errors = {}
        if (!draft.name.trim()) e.name = 'Give it a name, e.g. Netflix'
        const amt = parseFloat(draft.amount)
        if (!draft.amount || isNaN(amt) || amt <= 0) e.amount = 'Enter an amount above 0'
        if (!isValidDate(draft.startDate)) e.startDate = 'Use YYYY-MM-DD'
        if (draft.endDate && !isValidDate(draft.endDate)) e.endDate = 'Use YYYY-MM-DD, or leave empty'
        else if (draft.endDate && draft.endDate < draft.startDate) e.endDate = 'Must be on or after the first charge'
        setErrors(e)
        return Object.keys(e).length === 0
    }

    async function submit() {
        if (!validate()) return
        setSaving(true)
        const ok = await onSave(draft)
        setSaving(false)
        if (ok) onCancel()
    }

    // Tell people what will happen when the first charge is in the past
    const today = localToday()
    const startsInPast = !isEditing && isValidDate(draft.startDate) && draft.startDate < today
    let pastCount = 0
    if (startsInPast) {
        for (let n = 0; n < 5000; n++) {
            const d = occurrence(draft.startDate, draft.frequency, n)
            if (d > today || (draft.endDate && d > draft.endDate)) break
            pastCount++
        }
    }

    return (
        <View style={styles.card}>
        <View style={styles.header}>
        <Text style={styles.title}>{isEditing ? 'Edit Subscription' : 'New Subscription'}</Text>
        <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
        <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        </View>

        <Text style={styles.label}>Type</Text>
        <View style={styles.row}>
        {TYPES.map(t => (
            <TouchableOpacity
            key={t}
            style={[styles.chip, draft.type === t && { backgroundColor: TYPE_COLORS[t].bg, borderColor: TYPE_COLORS[t].bg }]}
            onPress={() => { set('type', t); set('category', '') }}
            >
            <Text style={[styles.chipText, draft.type === t && styles.chipTextActive]}>{t}</Text>
            </TouchableOpacity>
        ))}
        </View>

        <Text style={styles.label}>Name</Text>
        <TextInput
        style={[styles.input, errors.name && styles.inputError]}
        placeholder="e.g. Netflix, Rent, Paycheck"
        value={draft.name}
        onChangeText={v => set('name', v)}
        placeholderTextColor="#aaa"
        />
        {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}

        <Text style={styles.label}>Amount each time</Text>
        <TextInput
        style={[styles.input, errors.amount && styles.inputError]}
        placeholder="0.00"
        value={draft.amount}
        onChangeText={v => set('amount', v)}
        keyboardType="decimal-pad"
        placeholderTextColor="#aaa"
        />
        {errors.amount && <Text style={styles.errorText}>{errors.amount}</Text>}

        <Text style={styles.label}>How often</Text>
        <View style={styles.row}>
        {FREQUENCIES.map(f => (
            <TouchableOpacity key={f} style={[styles.chip, draft.frequency === f && styles.chipActive]} onPress={() => set('frequency', f)}>
            <Text style={[styles.chipText, draft.frequency === f && styles.chipTextActive]}>{FREQUENCY_LABELS[f]}</Text>
            </TouchableOpacity>
        ))}
        </View>

        <Text style={styles.label}>Category</Text>
        <View style={styles.row}>
        {categories?.map(c => (
            <TouchableOpacity key={c} style={[styles.chip, draft.category === c && styles.chipActive]} onPress={() => set('category', draft.category === c ? '' : c)}>
            <Text style={[styles.chipText, draft.category === c && styles.chipTextActive]}>{c}</Text>
            </TouchableOpacity>
        ))}
        </View>

        <View style={styles.dateRow}>
        <View style={{ flex: 1 }}>
        <Text style={styles.label}>{isEditing ? 'Charges count from' : 'First charge'}</Text>
        <TextInput
        style={[styles.input, errors.startDate && styles.inputError]}
        placeholder="YYYY-MM-DD"
        value={draft.startDate}
        onChangeText={v => set('startDate', v)}
        placeholderTextColor="#aaa"
        />
        {errors.startDate && <Text style={styles.errorText}>{errors.startDate}</Text>}
        </View>
        <View style={{ flex: 1 }}>
        <Text style={styles.label}>Ends (optional)</Text>
        <TextInput
        style={[styles.input, errors.endDate && styles.inputError]}
        placeholder="YYYY-MM-DD"
        value={draft.endDate}
        onChangeText={v => set('endDate', v)}
        placeholderTextColor="#aaa"
        />
        {errors.endDate && <Text style={styles.errorText}>{errors.endDate}</Text>}
        </View>
        </View>

        <Text style={styles.label}>Note (optional)</Text>
        <TextInput
        style={styles.input}
        placeholder="Add a note..."
        value={draft.note}
        onChangeText={v => set('note', v)}
        placeholderTextColor="#aaa"
        />

        {startsInPast && pastCount > 0 && (
            <Text style={styles.hint}>
            {pastCount} past charge{pastCount > 1 ? 's' : ''} from {formatDate(draft.startDate)} to today will be added to your transactions.
            </Text>
        )}
        {isEditing && (
            <Text style={styles.hint}>Changes apply to future charges. Charges already added stay as they are.</Text>
        )}

        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: color }, saving && { opacity: 0.6 }]} onPress={submit} disabled={saving}>
        <Text style={styles.saveText}>{saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Subscription'}</Text>
        </TouchableOpacity>
        </View>
    )
}

const styles = StyleSheet.create({
    card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 0.5, borderColor: '#e0e0e0' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
    title: { fontSize: 18, fontWeight: '700', color: '#2c3e50' },
    cancelBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#aaa' },
    cancelText: { fontSize: 13, color: '#555', fontWeight: '600' },
    label: { fontSize: 12, fontWeight: '600', color: '#555', marginBottom: 6, marginTop: 12 },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#f8f9fa' },
    chipActive: { backgroundColor: '#2c3e50', borderColor: '#2c3e50' },
    chipText: { fontSize: 12, color: '#555', fontWeight: '500' },
    chipTextActive: { color: '#fff' },
    input: { backgroundColor: '#f8f9fa', borderRadius: 8, padding: 10, fontSize: 13, borderWidth: 1, borderColor: '#e8e8e8', color: '#1a1a1a' },
    inputError: { borderColor: '#e74c3c' },
    errorText: { color: '#e74c3c', fontSize: 11, marginTop: 4 },
    dateRow: { flexDirection: 'row', gap: 12 },
    hint: { fontSize: 12, color: '#7f8c8d', marginTop: 12, lineHeight: 17 },
    saveBtn: { borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 16 },
    saveText: { color: '#fff', fontWeight: '700', fontSize: 14 },
})
