import { useState, useRef, useEffect, useMemo, RefObject } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, TextInputProps } from 'react-native'
import { DateField } from '../../../shared/ui/DateField'
import { Section, Button, Field, Chip } from '../../../shared/ui/ui'
import { useTheme, useStyles, Palette, tabular } from '../../../shared/theme/theme'
import { TRANSACTION_TYPES, DEFAULT_CATEGORIES } from '../logic/types'
import { SplitSection } from './SplitSection'
import { EditingTransaction } from '../logic/types'
import { merchantKey } from '../../../shared/money/entry'
import { amountText } from '../logic/listLogic'

interface Props {
    // Add form
    type: string
    category: string
    name: string
    amount: string
    details: string
    date: string
    errors: { amount?: string; date?: string; split?: string }
    saving: boolean
    success: boolean
    onTypeChange: (t: string) => void
    onCategoryChange: (c: string) => void
    onNameChange: (v: string) => void
    onAmountChange: (v: string) => void
    onDetailsChange: (v: string) => void
    onDateChange: (v: string) => void
    onAdd: () => void
    // Edit form
    editingTransaction: EditingTransaction | null
    onEditChange: (t: EditingTransaction) => void
    onSaveEdit: () => void
    onCancelEdit: () => void
    /** Adds a copy of the transaction being edited, dated today */
    onDuplicate: () => void
    budgetCategories: Record<string, string[]>
    // Name suggestions from past transactions
    pastTransactions: any[]
    onPickSuggestion: (t: any) => void
    // Splitting an expense with others
    splitOpen: boolean
    splits: { person: string; amount: string }[]
    onOpenSplit: () => void
    onCloseSplit: () => void
    onSplitsChange: (rows: { person: string; amount: string }[]) => void
    onSplitEvenly: () => void
    /** 'card' sits beside the list on a computer; 'sheet' fills the screen on a phone */
    variant?: 'card' | 'sheet'
    /** Closes the phone sheet */
    onClose?: () => void
}

export function TransactionForm({
    type, category, name, amount, details, date,
    errors, saving, success,
    onTypeChange, onCategoryChange, onNameChange,
    onAmountChange, onDetailsChange, onDateChange, onAdd,
    editingTransaction, onEditChange, onSaveEdit, onCancelEdit, onDuplicate, budgetCategories,
    pastTransactions, onPickSuggestion,
    splitOpen, splits, onOpenSplit, onCloseSplit, onSplitsChange, onSplitEvenly,
    variant = 'card', onClose,
}: Props) {
    const { c: C } = useTheme()
    const styles = useStyles(makeStyles)
    const isEditing = !!editingTransaction
    const activeType = isEditing ? editingTransaction!.type : type
    const activeCategory = isEditing ? editingTransaction!.category : category
    const submit = isEditing ? onSaveEdit : onAdd
    const title = isEditing ? 'Edit transaction' : 'Add transaction'

    const nameRef = useRef<TextInput>(null)
    const amountRef = useRef<TextInput>(null)
    const [nameFocused, setNameFocused] = useState(false)

    // After adding, put the cursor back in Name for the next entry
    useEffect(() => { if (success) nameRef.current?.focus() }, [success])

    // Past transactions whose name matches what's typed (newest version of each name)
    const suggestions = useMemo(() => {
        const q = name.trim().toLowerCase()
        if (isEditing || q.length < 2) return []
        const seen = new Set<string>()
        const starts: any[] = [], contains: any[] = []
        for (const t of pastTransactions) {
            const n = (t.name || '').trim()
            const key = n.toLowerCase()
            if (!n || seen.has(key) || key === q) continue
            seen.add(key)
            if (key.startsWith(q)) starts.push(t)
            else if (key.includes(q)) contains.push(t)
        }
        return [...starts, ...contains].slice(0, 5)
    }, [name, pastTransactions, isEditing])

    const categories = useMemo(() => {
        const list = budgetCategories[activeType]?.length > 0 ? budgetCategories[activeType] : (DEFAULT_CATEGORIES[activeType] ?? [])
        // Keep a category that isn't in the list (e.g. from an import) so it isn't lost when editing
        return activeCategory && !list.includes(activeCategory) ? [...list, activeCategory] : list
    }, [budgetCategories, activeType, activeCategory])

    const renameOffer = (() => {
        // Renamed: offer to use the new name for the whole place, now and for future imports
        if (!isEditing) return null
        const t = editingTransaction!
        const place = t.placeName || t.startName || ''
        const changed = t.startName !== undefined && t.name.trim() !== '' && t.name.trim() !== t.startName
        if (!changed || !merchantKey(place)) return null
        const label = `Use this name for all "${place}" transactions, now and in the future`
        return (
            <TouchableOpacity
                style={styles.renameRow}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: !!t.renameAll }}
                accessibilityLabel={label}
                onPress={() => onEditChange({ ...t, renameAll: !t.renameAll })}
            >
                <View style={[styles.checkbox, t.renameAll && styles.checkboxOn]}>
                    {t.renameAll && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.renameText}>{label}</Text>
            </TouchableOpacity>
        )
    })()

    const fields = (
        <>
            {!isEditing && success && (
                <View style={styles.successBanner}>
                    <Text style={styles.successText}>Transaction added!</Text>
                </View>
            )}

            <Text style={styles.label}>Type</Text>
            <View style={styles.chips}>
                {TRANSACTION_TYPES.map(t => (
                    <Chip
                        key={t}
                        label={t}
                        tone={t.toLowerCase()}
                        selected={activeType === t}
                        onPress={() => isEditing ? onEditChange({ ...editingTransaction!, type: t, category: '' }) : onTypeChange(t)}
                    />
                ))}
            </View>

            <Text style={styles.label}>Category</Text>
            <View style={styles.chips}>
                {categories.length === 0 && <Text style={styles.hint}>No categories for this type yet. Add some on the Budget tab.</Text>}
                {categories.map(c => (
                    <Chip
                        key={c}
                        label={c}
                        selected={activeCategory === c}
                        onPress={() => isEditing ? onEditChange({ ...editingTransaction!, category: c }) : onCategoryChange(c)}
                    />
                ))}
            </View>

            <Field
                inputRef={nameRef}
                label="Name"
                placeholder="e.g. Grocery run, Netflix, Paycheck..."
                value={isEditing ? editingTransaction!.name : name}
                onChangeText={v => isEditing ? onEditChange({ ...editingTransaction!, name: v }) : onNameChange(v)}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setTimeout(() => setNameFocused(false), 200)} // let a tap on a suggestion land first
                onSubmitEditing={() => amountRef.current?.focus()}
                returnKeyType="next"
                submitBehavior="submit"
            />
            {renameOffer}
            {nameFocused && suggestions.length > 0 && (
                <View style={styles.suggestBox}>
                    <Text style={styles.suggestTitle}>Fill in from a past transaction</Text>
                    {suggestions.map(t => {
                        const shown = amountText(t)
                        return (
                            <TouchableOpacity
                                key={t.id}
                                accessibilityRole="button"
                                style={styles.suggestRow}
                                onPress={() => { onPickSuggestion(t); setNameFocused(false); amountRef.current?.focus() }}
                            >
                                <View style={{ flex: 1, minWidth: 0 }}>
                                    <Text style={styles.suggestName} numberOfLines={1}>{t.name}</Text>
                                    <Text style={styles.suggestMeta} numberOfLines={1}>
                                        {[t.type.charAt(0).toUpperCase() + t.type.slice(1), t.category_label].filter(Boolean).join(' · ')}
                                    </Text>
                                </View>
                                <Text style={[styles.suggestAmount, tabular, { color: shown.direction === 'in' ? C.good : shown.direction === 'move' ? C.move : C.ink }]}>
                                    {shown.text}
                                </Text>
                            </TouchableOpacity>
                        )
                    })}
                </View>
            )}

            <Field
                inputRef={amountRef}
                label="Amount"
                placeholder="0.00"
                value={isEditing ? editingTransaction!.amount : amount}
                onChangeText={v => isEditing ? onEditChange({ ...editingTransaction!, amount: v }) : onAmountChange(v)}
                onSubmitEditing={submit}
                returnKeyType="done"
                keyboardType="decimal-pad"
                error={!isEditing ? errors.amount : undefined}
                style={tabular}
            />
            {!isEditing && activeType === 'Expense' && (
                <SplitSection
                    open={splitOpen}
                    rows={splits}
                    total={amount}
                    error={errors.split}
                    onOpen={onOpenSplit}
                    onClose={onCloseSplit}
                    onChange={onSplitsChange}
                    onSplitEvenly={onSplitEvenly}
                />
            )}

            <Text style={styles.label}>Date</Text>
            <DateField
                value={isEditing ? editingTransaction!.date : date}
                onChange={v => isEditing ? onEditChange({ ...editingTransaction!, date: v }) : onDateChange(v)}
                hasError={!isEditing && !!errors.date}
                onSubmit={submit}
            />
            {!isEditing && errors.date ? <Text style={styles.error}>{errors.date}</Text> : null}
            <View style={{ height: 14 }} />

            <Field
                label="Details (optional)"
                placeholder="Add a note..."
                value={isEditing ? editingTransaction!.details : details}
                onChangeText={v => isEditing ? onEditChange({ ...editingTransaction!, details: v }) : onDetailsChange(v)}
                onSubmitEditing={submit}
                returnKeyType="done"
            />
            {!isEditing && (
                <Text style={styles.hint}>Repeats every week, month or year? Add it in the Subscriptions tab instead.</Text>
            )}

            <View style={styles.footer}>
                <Button label={isEditing ? 'Save changes' : 'Add transaction'} onPress={submit} loading={saving} style={styles.primary} />
                {isEditing && <Button label="Duplicate" variant="secondary" onPress={onDuplicate} disabled={saving} />}
                {isEditing && variant === 'card' && <Button label="Cancel" variant="secondary" onPress={onCancelEdit} disabled={saving} />}
            </View>
            {isEditing && <Text style={[styles.hint, { marginTop: 10 }]}>Duplicate adds a copy dated today.</Text>}
        </>
    )

    if (variant === 'sheet') {
        return (
            <View style={styles.sheet}>
                <View style={styles.sheetHead}>
                    <Text style={styles.sheetTitle} accessibilityRole="header">{title}</Text>
                    <Button label="Cancel" variant="ghost" onPress={() => onClose?.()} />
                </View>
                <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
                    {fields}
                </ScrollView>
            </View>
        )
    }
    return <Section title={title}>{fields}</Section>
}

const makeStyles = (C: Palette) => StyleSheet.create({
    fieldWrap: { marginBottom: 14 },
    input: { backgroundColor: C.surfaceAlt, borderRadius: 10, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: C.ink },
    label: { fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 6 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
    hint: { fontSize: 12, color: C.muted, lineHeight: 17 },
    error: { fontSize: 12, color: C.bad, marginTop: 5 },
    successBanner: { backgroundColor: C.goodSoft, borderRadius: 10, padding: 10, marginBottom: 14 },
    successText: { color: C.good, fontSize: 13, textAlign: 'center', fontWeight: '600' },
    renameRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: -6, marginBottom: 14 },
    checkbox: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: C.muted, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
    checkboxOn: { backgroundColor: C.primary, borderColor: C.primary },
    checkmark: { color: C.onPrimary, fontSize: 12, fontWeight: '700', lineHeight: 14 },
    renameText: { flex: 1, fontSize: 13, color: C.text, lineHeight: 18 },
    suggestBox: { borderWidth: 1, borderColor: C.line, borderRadius: 10, marginTop: -8, marginBottom: 14, backgroundColor: C.surface, overflow: 'hidden' },
    suggestTitle: { fontSize: 12, color: C.muted, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 2 },
    suggestRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderColor: C.line },
    suggestName: { fontSize: 14, color: C.ink },
    suggestMeta: { fontSize: 12, color: C.muted, marginTop: 1 },
    suggestAmount: { fontSize: 14, fontWeight: '600', marginLeft: 8 },
    footer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 },
    primary: { flexGrow: 1 },
    sheet: { flex: 1, backgroundColor: C.surface },
    sheetHead: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderColor: C.line,
    },
    sheetTitle: { fontSize: 18, fontWeight: '700', color: C.ink },
    sheetBody: { padding: 16, paddingBottom: 40 },
})
