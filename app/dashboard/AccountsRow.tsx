import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { HIGH_CARD_USAGE, updatedAgo } from '../../lib/bank'
import { AccountGroup } from './summary'
import { C, tabular, money } from './theme'

interface Props {
    cash: AccountGroup
    savings: AccountGroup
    cards: AccountGroup
    updatedAt: string | null
    wide: boolean
}

type Key = 'cash' | 'savings' | 'cards'
const LABELS: Record<Key, string> = { cash: 'Checking', savings: 'Savings', cards: 'Owed on cards' }

/** Balances from your linked banks. Tap a group to see its accounts. */
export function AccountsRow({ cash, savings, cards, updatedAt, wide }: Props) {
    const [open, setOpen] = useState<Key | null>(null)
    const groups = ([['cash', cash], ['savings', savings], ['cards', cards]] as [Key, AccountGroup][]).filter(([, g]) => g.accounts.length > 0)
    if (!groups.length) return null
    const shown = open ? groups.find(([k]) => k === open)?.[1] : null

    return (
        <View style={styles.box}>
            <View style={[styles.tiles, !wide && styles.tilesNarrow]}>
                {groups.map(([key, g], i) => (
                    <TouchableOpacity key={key} onPress={() => setOpen(o => (o === key ? null : key))}
                        accessibilityRole="button" accessibilityState={{ expanded: open === key }} accessibilityLabel={`${LABELS[key]}, show accounts`}
                        style={[styles.tile, i > 0 && (wide ? styles.dividerLeft : styles.dividerTop), open === key && styles.tileOpen]}>
                        <Text style={styles.tileLabel}>{LABELS[key]}</Text>
                        <Text style={[styles.tileValue, tabular, key === 'cards' && g.total > 0 && { color: C.bad }]}>{money(g.total)}</Text>
                        <Text style={styles.tileMeta}>{g.accounts.length} account{g.accounts.length === 1 ? '' : 's'} {open === key ? '▴' : '▾'}</Text>
                    </TouchableOpacity>
                ))}
            </View>
            {shown && (
                <View style={styles.list}>
                    {shown.accounts.map(a => {
                        const available = a.balance_available === null || a.balance_available === undefined ? null : Number(a.balance_available)
                        const used = open === 'cards' && a.balance !== null && available !== null && a.balance + available > 0
                            ? Math.round((a.balance / (a.balance + available)) * 100) : null
                        return (
                            <View key={a.id} style={styles.item}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.itemName}>{`${a.name ?? 'Account'}${a.last_four ? ` ••${a.last_four}` : ''}`}</Text>
                                    {used !== null && (
                                        <Text style={[styles.itemMeta, used >= HIGH_CARD_USAGE && { color: C.bad }]}>
                                            {used}% of the limit used{used >= HIGH_CARD_USAGE ? ', which can lower your credit score' : ''}
                                        </Text>
                                    )}
                                </View>
                                <Text style={[styles.itemValue, tabular]}>{a.balance === null ? 'After the next sync' : money(a.balance)}</Text>
                            </View>
                        )
                    })}
                </View>
            )}
            {updatedAt && <Text style={styles.updated}>Balances from your banks. {updatedAgo(updatedAt)}.</Text>}
        </View>
    )
}

const styles = StyleSheet.create({
    box: { backgroundColor: C.surface, borderRadius: 14, marginBottom: 20, overflow: 'hidden' },
    tiles: { flexDirection: 'row' },
    tilesNarrow: { flexDirection: 'column' },
    tile: { flex: 1, paddingVertical: 14, paddingHorizontal: 18 },
    tileOpen: { backgroundColor: '#f7f9fb' },
    dividerLeft: { borderLeftWidth: 1, borderColor: C.line },
    dividerTop: { borderTopWidth: 1, borderColor: C.line },
    tileLabel: { fontSize: 13, color: C.muted, fontWeight: '600' },
    tileValue: { fontSize: 22, fontWeight: '700', color: C.ink, marginTop: 2 },
    tileMeta: { fontSize: 12, color: C.faint, marginTop: 2 },
    list: { borderTopWidth: 1, borderColor: C.line, paddingHorizontal: 18, paddingVertical: 6 },
    item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 12 },
    itemName: { fontSize: 14, color: C.ink },
    itemMeta: { fontSize: 12, color: C.muted, marginTop: 2 },
    itemValue: { fontSize: 14, fontWeight: '600', color: C.ink },
    updated: { fontSize: 11, color: C.faint, paddingHorizontal: 18, paddingBottom: 10, paddingTop: 2 },
})
