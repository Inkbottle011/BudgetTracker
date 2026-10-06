import { useCallback, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { supabase } from '../../lib/supabase'
import { cardSummary, formatBalance, updatedAgo, HIGH_CARD_USAGE, BankAccountRow } from '../../lib/bank'

/** Dashboard: balances on linked credit cards. Shows nothing until a card is linked. */
export function CardBalances() {
    const [accounts, setAccounts] = useState<BankAccountRow[]>([])

    useFocusEffect(useCallback(() => {
        supabase.from('bank_accounts')
            .select('id, name, last_four, type, balance_current, balance_available, balance_updated_at')
            .eq('type', 'credit')
            .then(({ data }: any) => setAccounts(data ?? []))
    }, []))

    const summary = cardSummary(accounts)
    if (summary.cards.length === 0) return null

    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <Text style={styles.title}>Credit cards</Text>
                {summary.cards.length > 1 && <Text style={styles.total}>{formatBalance(summary.totalOwed)} owed in total</Text>}
            </View>
            {summary.cards.map(c => {
                const high = c.usedPercent !== null && c.usedPercent >= HIGH_CARD_USAGE
                return (
                    <View key={c.id} style={styles.row}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.name}>{c.name ?? 'Card'}{c.last_four ? ` ••${c.last_four}` : ''}</Text>
                            {c.owed === null ? (
                                <Text style={styles.muted}>Balance appears after the next sync</Text>
                            ) : (
                                <>
                                    {c.available !== null && (
                                        <Text style={styles.muted}>
                                            {formatBalance(c.available)} available{c.usedPercent !== null ? ` · ${c.usedPercent}% used` : ''}
                                        </Text>
                                    )}
                                    {c.usedPercent !== null && (
                                        <View style={styles.bar} accessibilityLabel={high ? 'High card usage' : undefined}>
                                            <View style={[styles.barFill, { width: `${Math.min(100, c.usedPercent)}%` }, high && styles.barHigh]} />
                                        </View>
                                    )}
                                    {c.balance_updated_at && <Text style={styles.updated}>{updatedAgo(c.balance_updated_at)}</Text>}
                                </>
                            )}
                        </View>
                        {c.owed !== null && <Text style={[styles.owed, high && styles.owedHigh]}>{formatBalance(c.owed)} owed</Text>}
                    </View>
                )
            })}
        </View>
    )
}

const styles = StyleSheet.create({
    card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 0.5, borderColor: '#e0e0e0' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 },
    title: { fontSize: 16, fontWeight: '700', color: '#2c3e50' },
    total: { fontSize: 13, fontWeight: '600', color: '#2c3e50' },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 8, borderTopWidth: 0.5, borderColor: '#f0f0f0' },
    name: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
    muted: { fontSize: 12, color: '#888', marginTop: 2 },
    updated: { fontSize: 11, color: '#aaa', marginTop: 4 },
    owed: { fontSize: 15, fontWeight: '700', color: '#2c3e50' },
    owedHigh: { color: '#c0392b' },
    bar: { height: 6, backgroundColor: '#eef0f2', borderRadius: 3, marginTop: 6, overflow: 'hidden', maxWidth: 260 },
    barFill: { height: 6, backgroundColor: '#2980b9', borderRadius: 3 },
    barHigh: { backgroundColor: '#e74c3c' },
})
