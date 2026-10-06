import { useState, useRef, useEffect, useMemo } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { DateField } from '../../components/DateField'
import { TYPES, TYPE_COLORS, DEFAULT_CATEGORIES } from './types'
import { EditingTransaction } from './types'

interface Props {
    // Add form
    type: string
    category: string
    name: string
    amount: string
    details: string
    date: string
    errors: { amount?: string; date?: string }
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
    budgetCategories: Record<string, string[]>
    // Name suggestions from past transactions
    pastTransactions: any[]
    onPickSuggestion: (t: any) => void
}

export function TransactionForm({
    type, category, name, amount, details, date,
    errors, saving, success,
    onTypeChange, onCategoryChange, onNameChange,
    onAmountChange, onDetailsChange, onDateChange, onAdd,
    editingTransaction, onEditChange, onSaveEdit, onCancelEdit, budgetCategories,
    pastTransactions, onPickSuggestion,
}: Props) {
    const isEditing = !!editingTransaction
    const activeType = isEditing ? editingTransaction!.type : type
    const activeColor = TYPE_COLORS[activeType]?.bg || '#2c3e50'
    const submit = isEditing ? onSaveEdit : onAdd
    
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
    
    return (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Header */}
        <View style={styles.formHeader}>
        <Text style={styles.sectionTitle}>{isEditing ? 'Edit Transaction' : 'Add Transaction'}</Text>
        {isEditing && (
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancelEdit}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
        )}
        </View>
        
        {!isEditing && success && (
            <View style={styles.successBanner}>
            <Text style={styles.successText}>Transaction added!</Text>
            </View>
        )}
        
        {/* Type */}
        <Text style={styles.label}>Type</Text>
        <View style={styles.typeRow}>
        {TYPES.map(t => (
            <TouchableOpacity
            key={t}
            style={[styles.typeBtn, activeType === t && { backgroundColor: TYPE_COLORS[t].bg }]}
            onPress={() => isEditing
                ? onEditChange({ ...editingTransaction!, type: t, category: '' })
                : onTypeChange(t)
            }
            >
            <Text style={[styles.typeBtnText, activeType === t && { color: '#fff' }]}>{t}</Text>
            </TouchableOpacity>
        ))}
        </View>
        {/* Category */}
        <Text style={styles.label}>Category</Text>
        <View style={styles.categoryRow}>
        {(budgetCategories[activeType]?.length > 0 ? budgetCategories[activeType] : DEFAULT_CATEGORIES[activeType])?.map(c => {
            const activeCategory = isEditing ? editingTransaction!.category : category
            return (
                <TouchableOpacity
                key={c}
                style={[styles.catBtn, activeCategory === c && styles.catBtnActive]}
                onPress={() => isEditing
                    ? onEditChange({ ...editingTransaction!, category: c })
                    : onCategoryChange(c)
                }
                >
                <Text style={[styles.catBtnText, activeCategory === c && styles.catBtnTextActive]}>{c}</Text>
                </TouchableOpacity>
            )
        })}
        </View>
        
        {/* Name */}
        <Text style={styles.label}>Name</Text>
        <TextInput
        ref={nameRef}
        style={styles.input}
        placeholder="e.g. Grocery run, Netflix, Paycheck..."
        value={isEditing ? editingTransaction!.name : name}
        onChangeText={v => isEditing ? onEditChange({ ...editingTransaction!, name: v }) : onNameChange(v)}
        onFocus={() => setNameFocused(true)}
        onBlur={() => setTimeout(() => setNameFocused(false), 200)} // let a tap on a suggestion land first
        onSubmitEditing={() => amountRef.current?.focus()}
        returnKeyType="next"
        blurOnSubmit={false}
        placeholderTextColor="#aaa"
        />
        {nameFocused && suggestions.length > 0 && (
            <View style={styles.suggestBox}>
            <Text style={styles.suggestTitle}>Fill in from a past transaction</Text>
            {suggestions.map(t => (
                <TouchableOpacity
                key={t.id}
                style={styles.suggestRow}
                onPress={() => { onPickSuggestion(t); setNameFocused(false); amountRef.current?.focus() }}
                >
                <View style={{ flex: 1 }}>
                <Text style={styles.suggestName} numberOfLines={1}>{t.name}</Text>
                <Text style={styles.suggestMeta} numberOfLines={1}>
                {[t.type.charAt(0).toUpperCase() + t.type.slice(1), t.category_label].filter(Boolean).join(' · ')}
                </Text>
                </View>
                <Text style={[styles.suggestAmount, { color: t.type === 'expense' ? '#e74c3c' : '#27ae60' }]}>
                ${Number(t.amount).toFixed(2)}
                </Text>
                </TouchableOpacity>
            ))}
            </View>
        )}
        
        {/* Amount */}
        <Text style={styles.label}>Amount</Text>
        <TextInput
        ref={amountRef}
        style={[styles.input, !isEditing && errors.amount ? styles.inputError : null]}
        placeholder="0.00"
        value={isEditing ? editingTransaction!.amount : amount}
        onChangeText={v => isEditing ? onEditChange({ ...editingTransaction!, amount: v }) : onAmountChange(v)}
        onSubmitEditing={submit}
        returnKeyType="done"
        keyboardType="decimal-pad"
        placeholderTextColor="#aaa"
        />
        {!isEditing && errors.amount && <Text style={styles.errorText}>{errors.amount}</Text>}
        
        {/* Date */}
        <Text style={styles.label}>Date</Text>
        <DateField
        value={isEditing ? editingTransaction!.date : date}
        onChange={v => isEditing ? onEditChange({ ...editingTransaction!, date: v }) : onDateChange(v)}
        hasError={!isEditing && !!errors.date}
        onSubmit={submit}
        />
        {!isEditing && errors.date && <Text style={styles.errorText}>{errors.date}</Text>}
        
        {/* Details */}
        <Text style={styles.label}>Details (optional)</Text>
        <TextInput
        style={styles.input}
        placeholder="Add a note..."
        value={isEditing ? editingTransaction!.details : details}
        onChangeText={v => isEditing ? onEditChange({ ...editingTransaction!, details: v }) : onDetailsChange(v)}
        onSubmitEditing={submit}
        returnKeyType="done"
        placeholderTextColor="#aaa"
        />
        {!isEditing && (
            <Text style={styles.hint}>Repeats every week, month or year? Add it in the Subscriptions tab instead.</Text>
        )}
        {/* Submit */}
        <TouchableOpacity
        style={[styles.addBtn, { backgroundColor: activeColor }, saving && { opacity: 0.6 }]}
        onPress={submit}
        disabled={saving}
        >
        <Text style={styles.addBtnText}>{saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Transaction'}</Text>
        </TouchableOpacity>
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    container: { flex: 2, backgroundColor: '#fff', padding: 16 },
    formHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: '#2c3e50' },
    cancelBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#aaa' },
    cancelBtnText: { fontSize: 13, color: '#555', fontWeight: '600' },
    successBanner: { backgroundColor: '#eafaf1', borderRadius: 8, padding: 10, marginBottom: 10 },
    successText: { color: '#27ae60', fontSize: 13, textAlign: 'center', fontWeight: '600' },
    label: { fontSize: 12, fontWeight: '600', color: '#555', marginBottom: 6, marginTop: 10 },
    typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
    typeBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#f8f9fa' },
    typeBtnText: { fontSize: 12, color: '#555', fontWeight: '500' },
    categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
    catBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#f8f9fa' },
    catBtnActive: { backgroundColor: '#2c3e50', borderColor: '#2c3e50' },
    catBtnText: { fontSize: 11, color: '#555' },
    catBtnTextActive: { color: '#fff' },
    input: { backgroundColor: '#f8f9fa', borderRadius: 8, padding: 10, fontSize: 13, borderWidth: 1, borderColor: '#e8e8e8', color: '#1a1a1a', marginBottom: 2 },
    inputError: { borderColor: '#e74c3c' },
    errorText: { color: '#e74c3c', fontSize: 11, marginBottom: 6 },
    suggestBox: { borderWidth: 1, borderColor: '#e8e8e8', borderRadius: 8, marginTop: 4, backgroundColor: '#fff', overflow: 'hidden' },
    suggestTitle: { fontSize: 11, color: '#999', paddingHorizontal: 10, paddingTop: 6, paddingBottom: 2 },
    suggestRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7, borderTopWidth: 0.5, borderColor: '#f0f0f0' },
    suggestName: { fontSize: 13, color: '#1a1a1a' },
    suggestMeta: { fontSize: 11, color: '#999', marginTop: 1 },
    suggestAmount: { fontSize: 13, fontWeight: '600', marginLeft: 8 },
    hint: { fontSize: 12, color: '#7f8c8d', marginTop: 12 },
    addBtn: { borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 16 },
    addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
})