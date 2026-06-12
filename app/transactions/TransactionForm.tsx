import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
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
    recurring: string
    recurringEnd: string
    onRecurringChange: (v: string) => void
    onRecurringEndChange: (v: string) => void
    budgetCategories: Record<string, string[]>
}

export function TransactionForm({
    type, category, name, amount, details, date,
    errors, saving, success,
    onTypeChange, onCategoryChange, onNameChange,
    onAmountChange, onDetailsChange, onDateChange, onAdd,
    editingTransaction, onEditChange, onSaveEdit, onCancelEdit, recurring, recurringEnd, onRecurringChange, onRecurringEndChange,budgetCategories,
}: Props) {
    const isEditing = !!editingTransaction
    const activeType = isEditing ? editingTransaction!.type : type
    const activeColor = TYPE_COLORS[activeType]?.bg || '#2c3e50'
    
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
        style={styles.input}
        placeholder="e.g. Grocery run, Netflix, Paycheck..."
        value={isEditing ? editingTransaction!.name : name}
        onChangeText={v => isEditing ? onEditChange({ ...editingTransaction!, name: v }) : onNameChange(v)}
        placeholderTextColor="#aaa"
        />
        
        {/* Amount */}
        <Text style={styles.label}>Amount</Text>
        <TextInput
        style={[styles.input, !isEditing && errors.amount ? styles.inputError : null]}
        placeholder="0.00"
        value={isEditing ? editingTransaction!.amount : amount}
        onChangeText={v => isEditing ? onEditChange({ ...editingTransaction!, amount: v }) : onAmountChange(v)}
        keyboardType="decimal-pad"
        placeholderTextColor="#aaa"
        />
        {!isEditing && errors.amount && <Text style={styles.errorText}>{errors.amount}</Text>}
        
        {/* Date */}
        <Text style={styles.label}>Date</Text>
        <TextInput
        style={[styles.input, !isEditing && errors.date ? styles.inputError : null]}
        placeholder="YYYY-MM-DD"
        value={isEditing ? editingTransaction!.date : date}
        onChangeText={v => isEditing ? onEditChange({ ...editingTransaction!, date: v }) : onDateChange(v)}
        placeholderTextColor="#aaa"
        />
        {!isEditing && errors.date && <Text style={styles.errorText}>{errors.date}</Text>}
        
        {/* Details */}
        <Text style={styles.label}>Details (optional)</Text>
        <TextInput
        style={styles.input}
        placeholder="Add a note..."
        value={isEditing ? editingTransaction!.details : details}
        onChangeText={v => isEditing ? onEditChange({ ...editingTransaction!, details: v }) : onDetailsChange(v)}
        placeholderTextColor="#aaa"
        />
        {/* Recurring */}
        <Text style={styles.label}>Recurring</Text>
        <View style={styles.typeRow}>
        {['none', 'weekly', 'biweekly', 'monthly', 'yearly'].map(r => {
            const activeRecurring = isEditing ? editingTransaction!.recurring : recurring
            return (
                <TouchableOpacity
                key={r}
                style={[styles.catBtn, activeRecurring === r && styles.catBtnActive]}
                onPress={() => isEditing
                    ? onEditChange({ ...editingTransaction!, recurring: r })
                    : onRecurringChange(r)
                }
                >
                <Text style={[styles.catBtnText, activeRecurring === r && styles.catBtnTextActive]}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
                </Text>
                </TouchableOpacity>
            )
        })}
        </View>
        
        {(isEditing ? editingTransaction!.recurring !== 'none' : recurring !== 'none') && (
            <>
            <Text style={styles.label}>End Date (optional)</Text>
            <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            value={isEditing ? editingTransaction!.recurring_end : recurringEnd}
            onChangeText={v => isEditing
                ? onEditChange({ ...editingTransaction!, recurring_end: v })
                : onRecurringEndChange(v)
            }
            placeholderTextColor="#aaa"
            />
            </>
        )}
        {/* Submit */}
        <TouchableOpacity
        style={[styles.addBtn, { backgroundColor: activeColor }, saving && { opacity: 0.6 }]}
        onPress={isEditing ? onSaveEdit : onAdd}
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
    addBtn: { borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 16 },
    addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
})