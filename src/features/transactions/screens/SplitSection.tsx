import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { parseAmount } from '../../../shared/money/entry'
import { totalShares } from '../logic/splits'
import { formatMoney } from '../../../shared/money/format'
import { useTheme, useStyles, Palette, tabular } from '../../../shared/theme/theme'
import { Private } from '../../../shared/ui/Private'

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
    const { c: C } = useTheme()
    const styles = useStyles(makeStyles)

    if (!open) {
        return (
            <TouchableOpacity accessibilityRole="button" onPress={onOpen} style={styles.openBtn}>
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
                <TouchableOpacity accessibilityRole="button" onPress={onClose}><Text style={styles.quiet}>Don't split</Text></TouchableOpacity>
            </View>
            {rows.map((r, i) => (
                <View key={i} style={styles.row}>
                    <TextInput
                        accessibilityLabel={`Person ${i + 1} name`}
                        style={[styles.input, styles.nameInput]}
                        placeholder="Name"
                        value={r.person}
                        onChangeText={v => update(i, 'person', v)}
                        placeholderTextColor={C.faint}
                    />
                    <TextInput
                        accessibilityLabel={`Person ${i + 1} owes`}
                        style={[styles.input, styles.amountInput, tabular]}
                        placeholder="0.00"
                        value={r.amount}
                        onChangeText={v => update(i, 'amount', v)}
                        keyboardType="decimal-pad"
                        placeholderTextColor={C.faint}
                    />
                    <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={`Remove person ${i + 1}`}
                        onPress={() => onChange(rows.filter((_, j) => j !== i))}
                        style={styles.x}
                    >
                        <Text style={styles.quiet}>✕</Text>
                    </TouchableOpacity>
                </View>
            ))}
            <View style={styles.actions}>
                <TouchableOpacity accessibilityRole="button" onPress={() => onChange([...rows, { person: '', amount: '' }])}>
                    <Text style={styles.link}>+ Add person</Text>
                </TouchableOpacity>
                {rows.length > 0 && amount > 0 && (
                    <TouchableOpacity accessibilityRole="button" onPress={onSplitEvenly}>
                        <Text style={styles.link}>Split evenly</Text>
                    </TouchableOpacity>
                )}
            </View>
            {owed > 0 && (
                <Text style={styles.summary}>
                    Others owe you <Private kind="transactions">{formatMoney(owed)}</Private> · your share <Private kind="transactions">{formatMoney(Math.max(0, amount - owed))}</Private>
                </Text>
            )}
            {error && <Text style={styles.error}>{error}</Text>}
        </View>
    )
}

const makeStyles = (C: Palette) => StyleSheet.create({
    openBtn: { marginTop: -4, marginBottom: 14, alignSelf: 'flex-start', paddingVertical: 2 },
    link: { color: C.primary, fontWeight: '600', fontSize: 13 },
    box: { borderWidth: 1, borderColor: C.line, backgroundColor: C.surfaceAlt, borderRadius: 10, padding: 12, marginTop: -4, marginBottom: 14 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    title: { fontSize: 13, fontWeight: '600', color: C.ink },
    row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
    input: { backgroundColor: C.surface, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, borderWidth: 1, borderColor: C.line, color: C.ink },
    nameInput: { flex: 1, minWidth: 0 },
    amountInput: { width: 88 },
    x: { paddingHorizontal: 6, paddingVertical: 4 },
    quiet: { color: C.muted, fontSize: 13 },
    actions: { flexDirection: 'row', gap: 16, marginTop: 2 },
    summary: { fontSize: 13, color: C.text, marginTop: 8 },
    error: { color: C.bad, fontSize: 12, marginTop: 6 },
})
