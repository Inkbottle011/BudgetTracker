// Categories your transactions use that aren't in your budget (often a typo, like "Subscribtions"):
// move their transactions into one you have, or add the category to your budget.
import { useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useStyles, Palette } from '../../../shared/theme/theme'
import { Button, Chip, Section } from '../../../shared/ui/ui'

export function UnplannedCategories({ categories, choices, onMove, onAdd }: {
    categories: { name: string; count: number }[]
    /** Your spending categories, to move into */
    choices: string[]
    onMove: (from: string, to: string) => void
    onAdd: (name: string) => void
}) {
    const s = useStyles(makeStyles)
    const [moving, setMoving] = useState<string | null>(null)
    if (!categories.length) return null
    return (
        <View accessibilityLabel="Categories not in your budget">
            <Section title="Categories not in your budget">
                <Text style={s.help}>Your transactions use these, but your budget doesn't. Move them into a category you have, or add them.</Text>
                {categories.map((c, i) => (
                    <View key={c.name} style={[s.row, i > 0 && s.border]}>
                        <View style={s.top}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.name}>{c.name}</Text>
                                <Text style={s.count}>{c.count} transaction{c.count === 1 ? '' : 's'}</Text>
                            </View>
                            <Button small variant="secondary" label="Move to…" accessibilityLabel={`Move ${c.name} to…`} onPress={() => setMoving(moving === c.name ? null : c.name)} />
                            <Button small variant="ghost" label="Add to budget" accessibilityLabel={`Add ${c.name} to your budget`} onPress={() => onAdd(c.name)} />
                        </View>
                        {moving === c.name && (
                            <View style={s.chips}>
                                {choices.map(to => <Chip key={to} label={to} onPress={() => { setMoving(null); onMove(c.name, to) }} />)}
                            </View>
                        )}
                    </View>
                ))}
            </Section>
        </View>
    )
}

const makeStyles = (C: Palette) => StyleSheet.create({
    help: { fontSize: 13, color: C.muted, lineHeight: 18, marginBottom: 6 },
    row: { paddingVertical: 10 },
    border: { borderTopWidth: 1, borderColor: C.line },
    top: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    name: { fontSize: 15, fontWeight: '600', color: C.ink },
    count: { fontSize: 12, color: C.muted, marginTop: 1 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
})
