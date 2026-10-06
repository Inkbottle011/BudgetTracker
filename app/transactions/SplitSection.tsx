import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { parseAmount } from '../../lib/entry'
import { totalShares } from '../../lib/splits'

interface Props {
    open: boolean
    rows: { person: string; amount: string }[]
    total: string          // the expense amount as typed
    error?: string
    onOpen: () => void
    onClose: () => void
    onChange: (rows: { person: string; amount: string }[]) => void
    onSplitEvenly: () => void
}

/** "Split with others": who owes you part of this expense. */
export function SplitSection({ open, rows, total, error, onOpen, onClose, onChange, onSplitEvenly }: Props) {
    if (!open) {
        return (
            <TouchableOpacity onPress={onOpen} style={styles.openBtn}>
                <Text style={styles.link}>+ Split with others</Text>
            </TouchableOpacity>
        )
    }

    const owed = totalShares(rows)
    const amount = Math.abs(parseAmount(total) ?? 0)
    const update = (i: number, field: 'person' | 'amount', value: string) =>
        onChange(rows.map((r, j) => (j === i ? { ...r, [field]: value } : r)))

    return (
        <View style={styles.box}>
            <View style={styles.header}>
                <Text style={styles.title}>Who owes you for this?</Text>
                <TouchableOpacity onPress={onClose}><Text style={styles.remove}>Don't split</Text></TouchableOpacity>
            </View>
            {rows.map((r, i) => (
                <View key={i} style={styles.row}>
                    <TextInput
                        accessibilityLabel={`Person ${i + 1} name`}
                        style={[styles.input, styles.nameInput]}
                        placeholder="Name"
                        value={r.person}
                        onChangeText={v => update(i, 'person', v)}
                        placeholderTextColor="#aaa"
                    />
                    <TextInput
                        accessibilityLabel={`Person ${i + 1} owes`}
                        style={[styles.input, styles.amountInput]}
                        placeholder="0.00"
                        value={r.amount}
                        onChangeText={v => update(i, 'amount', v)}
                        keyboardType="decimal-pad"
                        placeholderTextColor="#aaa"
                    />
                    <TouchableOpacity
                        accessibilityLabel={`Remove person ${i + 1}`}
                        onPress={() => onChange(rows.filter((_, j) => j !== i))}
                        style={styles.x}
                    >
                        <Text style={styles.remove}>✕</Text>
                    </TouchableOpacity>
                </View>
            ))}
            <View style={styles.actions}>
                <TouchableOpacity onPress={() => onChange([...rows, { person: '', amount: '' }])}>
                    <Text style={styles.link}>+ Add person</Text>
                </TouchableOpacity>
                {rows.length > 0 && amount > 0 && (
                    <TouchableOpacity onPress={onSplitEvenly}>
                        <Text style={styles.link}>Split evenly</Text>
                    </TouchableOpacity>
                )}
            </View>
            {owed > 0 && (
                <Text style={styles.summary}>
                    Others owe you ${owed.toFixed(2)} · your share ${Math.max(0, amount - owed).toFixed(2)}
                </Text>
            )}
            {error && <Text style={styles.error}>{error}</Text>}
        </View>
    )
}

const styles = StyleSheet.create({
    openBtn: { marginTop: 8, alignSelf: 'flex-start' },
    link: { color: '#16a085', fontWeight: '600', fontSize: 12 },
    box: { borderWidth: 1, borderColor: '#d5efe9', backgroundColor: '#f4fbf9', borderRadius: 8, padding: 10, marginTop: 8 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    title: { fontSize: 12, fontWeight: '700', color: '#2c3e50' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
    input: { backgroundColor: '#fff', borderRadius: 6, padding: 8, fontSize: 13, borderWidth: 1, borderColor: '#e8e8e8', color: '#1a1a1a' },
    nameInput: { flex: 1, minWidth: 0 },
    amountInput: { width: 84 },
    x: { paddingHorizontal: 6 },
    remove: { color: '#999', fontSize: 12 },
    actions: { flexDirection: 'row', gap: 16, marginTop: 2 },
    summary: { fontSize: 12, color: '#555', marginTop: 8 },
    error: { color: '#e74c3c', fontSize: 11, marginTop: 6 },
})
