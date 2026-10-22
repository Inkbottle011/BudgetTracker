// The budget at its simplest: each item once, with what it is a month. Most things cost the same every
// month, so one tap changes the whole year; items that vary say so and can show their months.
import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { useTheme, useStyles, Palette, tabular } from '../../../shared/theme/theme'
import { Button, Section, EmptyState, useIsWide } from '../../../shared/ui/ui'
import { BudgetType, MONTHS, MONTH_NAMES, SECTIONS } from '../logic/types'
import { BudgetViewProps, SectionHeading, AddItemRow, DeleteButton, dollars } from './BudgetTable'

interface Props extends BudgetViewProps {
    /** The month the amounts are shown for: this month in the current year, otherwise January */
    month: number
    /** Whether "from this month on" makes sense (the current year, after January) */
    canStartLater: boolean
    varies: (itemId: string) => boolean
    onSetEveryMonth: (itemId: string, value: string) => void
    onSetFrom: (itemId: string, month: number, value: string) => void
    onEditMonths: () => void
    onPlan: () => void
    onSplit: (item: BudgetViewProps['items'][number]) => void
}

export function BudgetSimpleView(p: Props) {
    const { c: C } = useTheme()
    const s = useStyles(makeStyles)
    const wide = useIsWide()
    const m = p.month
    const income = p.getMonthTotal('income', m)
    const spending = p.getMonthTotal('expense', m)
    const saving = p.getMonthTotal('savings', m) + p.getMonthTotal('investment', m)
    const left = p.getNetByMonth(m)

    return (
        <View>
            {!p.items.length && (
                <Section>
                    <EmptyState
                        title="Your budget is empty"
                        body="Answer a few questions about your pay, your bills and what you're saving for, and we'll fill it in. You can change anything afterwards."
                        action={<Button label="Answer a few questions" onPress={p.onPlan} />}
                    />
                </Section>
            )}

            <Section>
                <Text style={s.summaryTitle}>Your month ({MONTH_NAMES[m - 1]})</Text>
                <View style={[s.stats, !wide && s.statsPhone]}>
                    <Stat label="Coming in" value={income} color={C.good} s={s} />
                    <Stat label="Spending" value={spending} color={C.bad} s={s} />
                    <Stat label="Saving and investing" value={saving} color={C.saved} s={s} />
                    <Stat label="Left over" value={left} color={left < 0 ? C.bad : C.ink} s={s} strong />
                </View>
                {left < 0 && <Text style={[s.note, { color: C.bad }]}>You've planned {dollars(-left)} more than comes in this month.</Text>}
            </Section>

            {SECTIONS.map(type => <SimpleSection key={type} type={type} {...p} />)}
        </View>
    )
}

function Stat({ label, value, color, s, strong }: { label: string; value: number; color: string; s: Styles; strong?: boolean }) {
    return (
        <View style={s.stat}>
            <Text style={s.statLabel}>{label}</Text>
            <Text style={[s.statValue, strong && s.statStrong, tabular, { color }]}>{dollars(value)}</Text>
        </View>
    )
}

function SimpleSection({ type, ...p }: Props & { type: BudgetType }) {
    const s = useStyles(makeStyles)
    const items = p.items.filter(i => i.type === type)
    return (
        <Section>
            <SectionHeading type={type} right={<Text style={[s.sectionTotal, tabular]}>{dollars(p.getMonthTotal(type, p.month))} a month</Text>} />
            {items.map((item, i) => <SimpleRow key={item.id} item={item} first={i === 0} {...p} />)}
            <AddItemRow type={type} {...p} />
        </Section>
    )
}

function SimpleRow({ item, first, ...p }: Props & { item: BudgetViewProps['items'][number]; first: boolean }) {
    const { c: C } = useTheme()
    const s = useStyles(makeStyles)
    const [editing, setEditing] = useState(false)
    const [value, setValue] = useState('')
    const [open, setOpen] = useState(false)
    const amount = p.getAmount(item.id, p.month)
    const varies = p.varies(item.id)
    const when = varies ? `in ${MONTH_NAMES[p.month - 1]}` : 'a month'

    const save = (everyMonth: boolean) => {
        setEditing(false)
        if (everyMonth) p.onSetEveryMonth(item.id, value)
        else p.onSetFrom(item.id, p.month, value)
    }

    return (
        <View style={[s.row, !first && s.rowBorder]}>
            <View style={s.rowTop}>
                <View style={s.nameWrap}>
                    <Text style={s.name} numberOfLines={2}>{item.name}</Text>
                    {varies && (
                        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${open ? 'Hide' : 'Show'} ${item.name} by month`} onPress={() => setOpen(!open)} hitSlop={6}>
                            <View style={s.variesRow}><Text style={s.varies}>Varies by month</Text><Text style={s.varies}>{open ? '▴' : '▾'}</Text></View>
                        </TouchableOpacity>
                    )}
                </View>
                {!editing && (
                    <TouchableOpacity
                        accessibilityRole="button" accessibilityLabel={`Change ${item.name}, ${dollars(amount)} ${when}`}
                        onPress={() => { setValue(amount > 0 ? String(amount) : ''); setEditing(true) }}
                        style={s.amountBtn}
                    >
                        <Text style={[s.amount, tabular, amount === 0 && { color: C.faint, fontWeight: '400' }]}>{dollars(amount)}</Text>
                        <Text style={s.per}>{varies ? MONTHS[p.month - 1].toLowerCase() : '/mo'}</Text>
                    </TouchableOpacity>
                )}
                <DeleteButton name={item.name} onPress={() => p.onDeleteItem(item.id)} />
            </View>

            {editing && (
                <View style={s.editor}>
                    <TextInput
                        accessibilityLabel={`New amount for ${item.name}`} value={value} onChangeText={setValue}
                        onSubmitEditing={() => save(true)} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={C.faint}
                        autoFocus style={[s.input, tabular]}
                    />
                    <View style={s.editorButtons}>
                        <Text style={s.editorLabel}>Use it for</Text>
                        <Button small label="Every month" onPress={() => save(true)} />
                        {p.canStartLater && (
                            <Button small variant="secondary" label={p.month === 12 ? 'December only' : `${MONTHS[p.month - 1]} to Dec`} onPress={() => save(false)} />
                        )}
                        <Button small variant="ghost" label="Cancel" onPress={() => setEditing(false)} />
                        {item.type === 'expense' && (
                            <Button small variant="ghost" label="Split into two" onPress={() => { setEditing(false); p.onSplit(item) }} style={{ marginLeft: 'auto' }} />
                        )}
                    </View>
                </View>
            )}

            {varies && open && (
                <View style={s.months}>
                    {MONTHS.map((name, i) => (
                        <Text key={name} style={[s.monthCell, tabular, i + 1 === p.month && s.monthNow]}>{`${name} ${dollars(p.getAmount(item.id, i + 1))}`}</Text>
                    ))}
                    <Button small variant="ghost" label="Edit single months" onPress={p.onEditMonths} />
                </View>
            )}
        </View>
    )
}

type Styles = ReturnType<typeof makeStyles>

const makeStyles = (C: Palette) => StyleSheet.create({
    summaryTitle: { fontSize: 13, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },
    stats: { flexDirection: 'row', gap: 10 },
    statsPhone: { flexWrap: 'wrap' },
    stat: { flex: 1, minWidth: 130, backgroundColor: C.surfaceAlt, borderRadius: 12, padding: 12 },
    statLabel: { fontSize: 12.5, color: C.muted, fontWeight: '600' },
    statValue: { fontSize: 20, fontWeight: '700', marginTop: 4 },
    statStrong: { fontSize: 24, fontWeight: '800' },
    note: { fontSize: 13, fontWeight: '600', marginTop: 10 },
    sectionTotal: { fontSize: 14, fontWeight: '600', color: C.muted },
    row: { paddingVertical: 10 },
    rowBorder: { borderTopWidth: 1, borderColor: C.line },
    rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    nameWrap: { flex: 1, gap: 2 },
    name: { fontSize: 15, color: C.ink, fontWeight: '500' },
    variesRow: { flexDirection: 'row', gap: 4 },
    varies: { fontSize: 12, color: C.primary, fontWeight: '600' },
    amountBtn: { flexDirection: 'row', alignItems: 'baseline', gap: 4, minWidth: 110, justifyContent: 'flex-end', borderRadius: 10, borderWidth: 1, borderColor: C.line, backgroundColor: C.surfaceAlt, paddingHorizontal: 12, paddingVertical: 8 },
    amount: { fontSize: 15, fontWeight: '700', color: C.ink },
    per: { fontSize: 12, color: C.muted },
    editor: { marginTop: 10, gap: 8 },
    input: { backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.primary, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: C.ink },
    editorButtons: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
    editorLabel: { fontSize: 13, color: C.muted },
    months: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10, alignItems: 'center' },
    monthCell: { fontSize: 12.5, color: C.text, backgroundColor: C.surfaceAlt, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, minWidth: 84 },
    monthNow: { borderWidth: 1, borderColor: C.primary },
})
