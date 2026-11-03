// The budget on a phone: one month at a time, each section as a short list.
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { useTheme, useStyles, Palette, tabular } from '../../../shared/theme/theme'
import { Button, Section } from '../../../shared/ui/ui'
import { BudgetType, MONTHS, MONTH_NAMES, SECTIONS, fillLabel } from '../logic/types'
import { BudgetViewProps, SectionHeading, AddItemRow, DeleteButton, dollars } from './BudgetTable'
import { Private } from '../../../shared/ui/Private'

interface Props extends BudgetViewProps {
    month: number
    onMonthChange: (m: number) => void
}

export function BudgetMonthView({ month, onMonthChange, ...p }: Props) {
    const { c: C } = useTheme()
    const styles = useStyles(makeStyles)
    const name = MONTH_NAMES[month - 1]
    const net = p.getNetByMonth(month)

    return (
        <View>
            <View style={styles.switcher}>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Previous month" disabled={month === 1}
                    onPress={() => onMonthChange(month - 1)} style={[styles.arrow, month === 1 && styles.arrowOff]}>
                    <Text style={styles.arrowText}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.monthName} accessibilityRole="header">{name}</Text>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Next month" disabled={month === 12}
                    onPress={() => onMonthChange(month + 1)} style={[styles.arrow, month === 12 && styles.arrowOff]}>
                    <Text style={styles.arrowText}>›</Text>
                </TouchableOpacity>
            </View>

            <Section>
                <Text style={styles.leftLabel}>Left over in {name}</Text>
                <Text style={[styles.leftValue, net < 0 && { color: C.bad }, net > 0 && { color: C.good }]}><Private kind="totals">{dollars(net)}</Private></Text>
                <Text style={styles.muted}>Income minus spending, savings and investments.</Text>
            </Section>

            {SECTIONS.map(type => <MonthSection key={type} type={type} month={month} {...p} />)}
        </View>
    )
}

function MonthSection({ type, month, ...p }: BudgetViewProps & { type: BudgetType; month: number }) {
    const { c: C } = useTheme()
    const styles = useStyles(makeStyles)
    const sectionItems = p.items.filter(i => i.type === type)
    const short = MONTHS[month - 1]

    return (
        <Section>
            <SectionHeading type={type} />
            {sectionItems.map((item, index) => {
                const amount = p.getAmount(item.id, month)
                const isEditing = p.editingCell?.itemId === item.id && p.editingCell?.month === month
                const where = `${item.name}, ${short}`
                return (
                    <View key={item.id} style={[styles.item, index > 0 && styles.itemBorder]}>
                        <View style={styles.itemRow}>
                            <View style={styles.itemText}>
                                <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                                <Text style={[styles.muted, tabular]}>Year: <Private kind="budget">{dollars(p.getRowTotal(item.id))}</Private></Text>
                            </View>
                            {!isEditing && (
                                <TouchableOpacity accessibilityRole="button" accessibilityLabel={where} style={styles.amountBtn}
                                    onPress={() => { if (!p.editingCell) p.onCellPress(item.id, month, amount) }}>
                                    <Text style={[styles.amountText, amount === 0 && styles.amountEmpty]}><Private kind="budget">{dollars(amount)}</Private></Text>
                                </TouchableOpacity>
                            )}
                            <DeleteButton name={item.name} onPress={() => p.onDeleteItem(item.id)} />
                        </View>
                        {isEditing && (
                            <View style={styles.editor}>
                                <TextInput
                                    accessibilityLabel={`${where} amount`}
                                    style={[styles.input, tabular]}
                                    value={p.editingValue}
                                    onChangeText={p.onCellChange}
                                    onSubmitEditing={() => p.onCellSave(item.id, month, p.editingValue, false)}
                                    keyboardType="decimal-pad"
                                    placeholder="0"
                                    placeholderTextColor={C.faint}
                                    autoFocus
                                />
                                <View style={styles.editorButtons}>
                                    <Button small label="Save" accessibilityLabel="Save this month only" onPress={() => p.onCellSave(item.id, month, p.editingValue, false)} />
                                    {month < 12 && (
                                        <Button small variant="secondary" label={fillLabel(month)} onPress={() => p.onCellSave(item.id, month, p.editingValue, true)} />
                                    )}
                                    <Button small variant="ghost" label="Cancel" onPress={p.onCellCancel} />
                                </View>
                            </View>
                        )}
                    </View>
                )
            })}

            <AddItemRow type={type} {...p} />

            <View style={styles.total}>
                <Text style={styles.totalLabel}>Total for {MONTH_NAMES[month - 1]}</Text>
                <Text style={[styles.totalValue, tabular]}><Private kind="totals">{dollars(p.getMonthTotal(type, month))}</Private></Text>
            </View>
        </Section>
    )
}

const makeStyles = (C: Palette) => StyleSheet.create({
    switcher: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 },
    arrow: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface, borderWidth: 1, borderColor: C.line },
    arrowOff: { opacity: 0.35 },
    arrowText: { fontSize: 24, lineHeight: 26, color: C.muted },
    monthName: { fontSize: 20, fontWeight: '700', color: C.ink, minWidth: 130, textAlign: 'center' },

    leftLabel: { fontSize: 13, color: C.muted, fontWeight: '600' },
    leftValue: { fontSize: 28, fontWeight: '700', color: C.ink, marginVertical: 4, ...tabular },
    muted: { fontSize: 12, color: C.muted, marginTop: 2 },

    item: { paddingVertical: 10 },
    itemBorder: { borderTopWidth: 1, borderColor: C.line },
    itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    itemText: { flex: 1 },
    itemName: { fontSize: 15, color: C.ink },
    amountBtn: { minWidth: 92, borderRadius: 10, borderWidth: 1, borderColor: C.line, backgroundColor: C.surfaceAlt, paddingHorizontal: 12, paddingVertical: 8 },
    amountText: { fontSize: 15, color: C.ink, fontWeight: '600', textAlign: 'right', ...tabular },
    amountEmpty: { color: C.faint, fontWeight: '400' },
    editor: { marginTop: 10, gap: 8 },
    input: {
        backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.primary,
        paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: C.ink,
    },
    editorButtons: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },

    total: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderColor: C.line, paddingTop: 12, marginTop: 4 },
    totalLabel: { fontSize: 14, fontWeight: '700', color: C.ink },
    totalValue: { fontSize: 15, fontWeight: '700', color: C.ink },
})
