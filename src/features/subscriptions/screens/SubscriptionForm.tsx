import { useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { TYPES, DEFAULT_CATEGORIES } from '../../transactions/api'
import { FREQUENCIES, FREQUENCY_LABELS, localToday, occurrence } from '../logic/subscriptions'
import { SubscriptionDraft, shortDate } from '../logic/useSubscriptions'
import { useStyles, Palette } from '../../../shared/theme/theme'
import { Button, Chip, Field } from '../../../shared/ui/ui'
import { parseAmount, parseDate } from '../../../shared/money/entry'

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
    const styles = useStyles(makeStyles)
    const categories = budgetCategories[draft.type]?.length ? budgetCategories[draft.type] : DEFAULT_CATEGORIES[draft.type]

    function set<K extends keyof SubscriptionDraft>(key: K, value: SubscriptionDraft[K]) {
        setDraft(d => ({ ...d, [key]: value }))
        setErrors(e => ({ ...e, [key]: undefined }))
    }

    // Accepts amounts like "$15.99" and dates like "10/5/2026"; returns the tidied draft, or null if invalid
    function validate(): SubscriptionDraft | null {
        const e: Errors = {}
        if (!draft.name.trim()) e.name = 'Give it a name, e.g. Netflix'
        const amt = parseAmount(draft.amount)
        if (amt === null || amt === 0) e.amount = 'Enter an amount, like 15.99'
        const start = parseDate(draft.startDate)
        const end = draft.endDate.trim() ? parseDate(draft.endDate) : ''
        if (!start) e.startDate = 'Use a date like 2026-10-05 or 10/5/2026'
        if (end === null) e.endDate = 'Use a date like 2026-10-05, or leave empty'
        else if (end && start && end < start) e.endDate = 'Must be on or after the first charge'
        setErrors(e)
        if (Object.keys(e).length) return null
        return { ...draft, amount: String(Math.abs(amt!)), startDate: start!, endDate: end || '' }
    }

    async function submit() {
        const clean = validate()
        if (!clean) return
        setDraft(clean)
        setSaving(true)
        const ok = await onSave(clean)
        setSaving(false)
        if (ok) onCancel()
    }

    // Tell people what will happen when the first charge is in the past
    const today = localToday()
    const startParsed = parseDate(draft.startDate)
    const startsInPast = !isEditing && !!startParsed && startParsed < today
    let pastCount = 0
    if (startsInPast) {
        for (let n = 0; n < 5000; n++) {
            const d = occurrence(startParsed!, draft.frequency, n)
            const endParsed = draft.endDate ? parseDate(draft.endDate) : null
            if (d > today || (endParsed && d > endParsed)) break
            pastCount++
        }
    }

    return (
        <View>
            <View style={styles.header}>
                <Text style={styles.title} accessibilityRole="header">{isEditing ? 'Edit subscription' : 'New subscription'}</Text>
                <Button variant="ghost" label="Cancel" accessibilityLabel="Close form" onPress={onCancel} />
            </View>

            <Text style={styles.label}>Type</Text>
            <View style={styles.chips}>
                {TYPES.map(t => (
                    <Chip key={t} label={t} tone={t.toLowerCase()} selected={draft.type === t} onPress={() => { set('type', t); set('category', '') }} />
                ))}
            </View>

            <Field label="Name" placeholder="e.g. Netflix, Rent, Paycheck" value={draft.name} onChangeText={v => set('name', v)} error={errors.name} />
            <Field label="Amount each time" placeholder="0.00" value={draft.amount} onChangeText={v => set('amount', v)} keyboardType="decimal-pad" error={errors.amount} />

            <Text style={styles.label}>How often</Text>
            <View style={styles.chips}>
                {FREQUENCIES.map(f => (
                    <Chip key={f} label={FREQUENCY_LABELS[f]} selected={draft.frequency === f} onPress={() => set('frequency', f)} />
                ))}
            </View>

            {!!categories?.length && (
                <>
                    <Text style={styles.label}>Category</Text>
                    <View style={styles.chips}>
                        {categories.map(c => (
                            <Chip key={c} label={c} selected={draft.category === c} onPress={() => set('category', draft.category === c ? '' : c)} />
                        ))}
                    </View>
                </>
            )}

            <View style={styles.dates}>
                <View style={styles.dateField}>
                    <Field label={isEditing ? 'Charges count from' : 'First charge'} placeholder="YYYY-MM-DD" value={draft.startDate}
                        onChangeText={v => set('startDate', v)} error={errors.startDate} />
                </View>
                <View style={styles.dateField}>
                    <Field label="Ends (optional)" placeholder="YYYY-MM-DD" value={draft.endDate}
                        onChangeText={v => set('endDate', v)} error={errors.endDate} />
                </View>
            </View>

            <Field label="Note (optional)" placeholder="Add a note" value={draft.note} onChangeText={v => set('note', v)} />

            {startsInPast && pastCount > 0 && (
                <Text style={styles.hint}>
                    {pastCount} past charge{pastCount > 1 ? 's' : ''} from {shortDate(startParsed!)} to today will be added to your transactions.
                </Text>
            )}
            {isEditing && (
                <Text style={styles.hint}>Changes apply to future charges. Charges already added stay as they are.</Text>
            )}

            <Button label={isEditing ? 'Save changes' : 'Add subscription'} onPress={submit} loading={saving} style={styles.save} />
        </View>
    )
}

const makeStyles = (C: Palette) => StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
    title: { fontSize: 18, fontWeight: '700', color: C.ink, flexShrink: 1 },
    label: { fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 6 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
    dates: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12 },
    dateField: { flexGrow: 1, flexBasis: 140 },
    hint: { fontSize: 13, color: C.muted, lineHeight: 18, marginBottom: 12 },
    save: { marginTop: 4 },
})
