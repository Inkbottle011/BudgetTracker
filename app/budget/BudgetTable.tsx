// The budget on a computer: every month side by side, one quiet section per kind of money.
// Shared pieces (section heading, add-item row, delete button) are also used by the phone view.
import { ReactNode } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { useTheme, useStyles, Palette, typeColors, tabular } from '../../lib/theme'
import { Button, Section } from '../../components/ui'
import { formatMoney } from '../../lib/format'
import { BudgetItem, BudgetType, MONTHS, SECTIONS, SECTION_LABELS, fillLabel } from './types'

export interface BudgetViewProps {
    items: BudgetItem[]
    addingType: BudgetType | null
    newItemName: string
    editingCell: { itemId: string; month: number } | null
    editingValue: string
    onSetAddingType: (t: BudgetType | null) => void
    onNewItemName: (v: string) => void
    onAddItem: () => void
    onDeleteItem: (id: string) => void
    onCellPress: (itemId: string, month: number, current: number) => void
    onCellChange: (v: string) => void
    onCellSave: (itemId: string, month: number, value: string, fillRight: boolean) => void
    onCellCancel: () => void
    getAmount: (itemId: string, month: number) => number
    getRowTotal: (itemId: string) => number
    getMonthTotal: (type: BudgetType, month: number) => number
    getSectionTotal: (type: BudgetType) => number
    getNetByMonth: (month: number) => number
    getNetTotal: () => number
}

/** Whole dollars for the grid: "$1,200", "-$270". */
export const dollars = (n: number) => formatMoney(n, { cents: false })

const MONTH_NUMBERS = Array.from({ length: 12 }, (_, i) => i + 1)

export function BudgetTable(props: BudgetViewProps) {
    const styles = useStyles(makeStyles)
    return (
        <View>
            <LeftOverGrid getNetByMonth={props.getNetByMonth} getNetTotal={props.getNetTotal} />
            {SECTIONS.map(type => (
                <Section key={type}>
                    <SectionHeading type={type} />
                    <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.gridScroll}>
                        <GridSection type={type} {...props} />
                    </ScrollView>
                </Section>
            ))}
        </View>
    )
}

/** "Left over each month": income minus spending, savings and investments. */
function LeftOverGrid({ getNetByMonth, getNetTotal }: Pick<BudgetViewProps, 'getNetByMonth' | 'getNetTotal'>) {
    const { c: C } = useTheme()
    const styles = useStyles(makeStyles)
    const tone = (n: number) => (n < 0 ? { color: C.bad } : n > 0 ? { color: C.good } : null)
    const total = getNetTotal()
    return (
        <Section>
            <Text style={styles.leftTitle}>Left over each month</Text>
            <Text style={styles.leftHint}>Income minus spending, savings and investments. Below zero means you've planned more than comes in.</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.gridScroll}>
                <View>
                    <HeaderRow />
                    <View style={styles.row}>
                        <View style={styles.colName}><Text style={styles.itemName}>Left over</Text></View>
                        {MONTH_NUMBERS.map(m => {
                            const net = getNetByMonth(m)
                            return <Text key={m} style={[styles.cellText, styles.cellStatic, styles.bold, tone(net)]}>{dollars(net)}</Text>
                        })}
                        <Text style={[styles.colTotal, styles.bold, tone(total)]}>{dollars(total)}</Text>
                        <View style={styles.colAction} />
                    </View>
                </View>
            </ScrollView>
        </Section>
    )
}

function HeaderRow() {
    const styles = useStyles(makeStyles)
    return (
        <View style={styles.headRow}>
            <View style={styles.colName} />
            {MONTHS.map(m => <Text key={m} style={[styles.headText, styles.colMonth]}>{m}</Text>)}
            <Text style={[styles.headText, styles.colTotal]}>Year</Text>
            <View style={styles.colAction} />
        </View>
    )
}

function GridSection({ type, ...p }: BudgetViewProps & { type: BudgetType }) {
    const { c: C } = useTheme()
    const styles = useStyles(makeStyles)
    const sectionItems = p.items.filter(i => i.type === type)
    return (
        <View>
            <HeaderRow />
            {sectionItems.map((item, index) => (
                <View key={item.id} style={[styles.row, index % 2 === 1 && styles.rowAlt]}>
                    <View style={styles.colName}><Text style={styles.itemName} numberOfLines={2}>{item.name}</Text></View>
                    {MONTH_NUMBERS.map(month => {
                        const isEditing = p.editingCell?.itemId === item.id && p.editingCell?.month === month
                        const amount = p.getAmount(item.id, month)
                        const where = `${item.name}, ${MONTHS[month - 1]}`
                        if (isEditing) {
                            return (
                                <View key={month} style={styles.colMonth}>
                                    <TextInput
                                        accessibilityLabel={`${where} amount`}
                                        style={[styles.cellInput, tabular]}
                                        value={p.editingValue}
                                        onChangeText={p.onCellChange}
                                        onSubmitEditing={() => p.onCellSave(item.id, month, p.editingValue, false)}
                                        keyboardType="decimal-pad"
                                        autoFocus
                                        placeholder="0"
                                        placeholderTextColor={C.faint}
                                    />
                                    <View style={styles.cellActions}>
                                        <IconButton label="Save this month only" glyph="✓" tone="primary" onPress={() => p.onCellSave(item.id, month, p.editingValue, false)} />
                                        {month < 12 && <IconButton label={fillLabel(month)} glyph="→" tone="primary" onPress={() => p.onCellSave(item.id, month, p.editingValue, true)} />}
                                        <IconButton label="Cancel" glyph="×" onPress={p.onCellCancel} />
                                    </View>
                                </View>
                            )
                        }
                        return (
                            <TouchableOpacity
                                key={month}
                                style={styles.colMonth}
                                accessibilityRole="button"
                                accessibilityLabel={where}
                                onPress={() => { if (!p.editingCell) p.onCellPress(item.id, month, amount) }}
                            >
                                <Text style={[styles.cellText, amount === 0 && styles.cellEmpty]}>{amount === 0 ? '–' : dollars(amount)}</Text>
                            </TouchableOpacity>
                        )
                    })}
                    <Text style={[styles.colTotal, styles.bold]}>{dollars(p.getRowTotal(item.id))}</Text>
                    <View style={styles.colAction}><DeleteButton name={item.name} onPress={() => p.onDeleteItem(item.id)} /></View>
                </View>
            ))}

            <AddItemRow type={type} {...p} />

            <View style={[styles.row, styles.totalRow]}>
                <View style={styles.colName}><Text style={[styles.itemName, styles.bold]}>Total</Text></View>
                {MONTH_NUMBERS.map(month => (
                    <Text key={month} style={[styles.cellText, styles.cellStatic, styles.bold]}>{dollars(p.getMonthTotal(type, month))}</Text>
                ))}
                <Text style={[styles.colTotal, styles.bold]}>{dollars(p.getSectionTotal(type))}</Text>
                <View style={styles.colAction} />
            </View>
        </View>
    )
}

/** Small colored dot + section name, e.g. "• Spending", with optional content on the right. */
export function SectionHeading({ type, right }: { type: BudgetType; right?: ReactNode }) {
    const { c: C } = useTheme()
    const styles = useStyles(makeStyles)
    return (
        <View style={styles.heading}>
            <View style={styles.headingLeft}>
                <View style={[styles.dot, { backgroundColor: typeColors(type, C).fg }]} />
                <Text style={styles.headingText} accessibilityRole="header">{SECTION_LABELS[type].title}</Text>
            </View>
            {right}
        </View>
    )
}

/** "+ Add item", which turns into a name box with Add and Cancel. */
export function AddItemRow({ type, addingType, newItemName, onNewItemName, onAddItem, onSetAddingType }:
    Pick<BudgetViewProps, 'addingType' | 'newItemName' | 'onNewItemName' | 'onAddItem' | 'onSetAddingType'> & { type: BudgetType }) {
    const { c: C } = useTheme()
    const styles = useStyles(makeStyles)
    const label = SECTION_LABELS[type]
    if (addingType !== type) {
        return (
            <View style={styles.addRow}>
                <Button variant="ghost" small label="+ Add item" accessibilityLabel={`Add a ${label.noun} item`} onPress={() => onSetAddingType(type)} />
            </View>
        )
    }
    return (
        <View style={[styles.addRow, styles.addRowOpen]}>
            <TextInput
                accessibilityLabel={`New ${label.noun} item name`}
                style={styles.addInput}
                placeholder={`Name, e.g. ${label.example}`}
                placeholderTextColor={C.faint}
                value={newItemName}
                onChangeText={onNewItemName}
                onSubmitEditing={onAddItem}
                autoFocus
            />
            <Button small label="Add" onPress={onAddItem} />
            <Button small variant="secondary" label="Cancel" accessibilityLabel="Cancel new item" onPress={() => onSetAddingType(null)} />
        </View>
    )
}

export function DeleteButton({ name, onPress }: { name: string; onPress: () => void }) {
    const styles = useStyles(makeStyles)
    return (
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Delete ${name}`} onPress={onPress} style={styles.iconBtn} hitSlop={8}>
            <Text style={styles.deleteGlyph}>×</Text>
        </TouchableOpacity>
    )
}

function IconButton({ label, glyph, onPress, tone }: { label: string; glyph: string; onPress: () => void; tone?: 'primary' }) {
    const { c: C } = useTheme()
    const styles = useStyles(makeStyles)
    return (
        <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={label}
            // @ts-ignore: shows a tooltip on the web
            title={label}
            onPress={onPress}
            style={[styles.cellBtn, tone === 'primary' && { backgroundColor: C.primarySoft, borderColor: C.primarySoft }]}
        >
            <Text style={[styles.cellBtnText, { color: tone === 'primary' ? C.primary : C.muted }]}>{glyph}</Text>
        </TouchableOpacity>
    )
}

const NAME_WIDTH = 170
const COL_WIDTH = 72
const TOTAL_WIDTH = 92
const ACTION_WIDTH = 32

const makeStyles = (C: Palette) => StyleSheet.create({
    gridScroll: { flexGrow: 1 },
    heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 },
    headingLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
    dot: { width: 10, height: 10, borderRadius: 5 },
    headingText: { fontSize: 18, fontWeight: '700', color: C.ink },
    leftTitle: { fontSize: 18, fontWeight: '700', color: C.ink },
    leftHint: { fontSize: 13, color: C.muted, marginTop: 4, marginBottom: 10, lineHeight: 18 },

    headRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderColor: C.line },
    headText: { fontSize: 12, color: C.muted, fontWeight: '600', textAlign: 'right', paddingHorizontal: 6 },
    row: { flexDirection: 'row', alignItems: 'center', minHeight: 40, borderRadius: 8 },
    rowAlt: { backgroundColor: C.surfaceAlt },
    totalRow: { borderTopWidth: 1, borderColor: C.line, borderRadius: 0, marginTop: 2 },
    colName: { width: NAME_WIDTH, paddingHorizontal: 8 },
    colMonth: { width: COL_WIDTH, paddingVertical: 6 },
    colTotal: { width: TOTAL_WIDTH, fontSize: 13, color: C.ink, textAlign: 'right', paddingHorizontal: 6, ...tabular },
    colAction: { width: ACTION_WIDTH, alignItems: 'center' },
    itemName: { fontSize: 14, color: C.ink },
    bold: { fontWeight: '700' },
    cellText: { fontSize: 13, color: C.text, textAlign: 'right', paddingHorizontal: 6, ...tabular },
    cellStatic: { width: COL_WIDTH },
    cellEmpty: { color: C.faint },
    cellInput: {
        marginHorizontal: 3, borderWidth: 1, borderColor: C.primary, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 6,
        fontSize: 13, textAlign: 'right', color: C.ink, backgroundColor: C.surface,
    },
    cellActions: { flexDirection: 'row', justifyContent: 'center', gap: 2, marginTop: 4 },
    cellBtn: { width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
    cellBtnText: { fontSize: 12, fontWeight: '700', lineHeight: 14 },
    iconBtn: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    deleteGlyph: { fontSize: 18, lineHeight: 20, color: C.faint },

    addRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 4 },
    addRowOpen: { gap: 8, flexWrap: 'wrap' },
    addInput: {
        flexGrow: 1, flexBasis: 160, maxWidth: 320, backgroundColor: C.surfaceAlt, borderRadius: 10, borderWidth: 1, borderColor: C.line,
        paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: C.ink,
    },
})
