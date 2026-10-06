import { useCallback, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { supabase } from '../../lib/supabase'
import { formatBalance, isSavingsAccount, updatedAgo, BankAccountRow } from '../../lib/bank'
import { dateParts, sumByType } from './calculations'

interface Props {
    transactions: { date: string; type: string; amount: number | string }[]
    year: number
}

/**
 * Dashboard: what's in your savings accounts and vaults (from linked banks), and how much you put
 * in and took out this year. The balance at the top leaves savings out, so this is where they show.
 */
export function SavingsBalances({ transactions, year }: Props) {
    const [accounts, setAccounts] = useState<BankAccountRow[]>([])

    useFocusEffect(useCallback(() => {
        supabase.from('bank_accounts')
            .select('id, name, last_four, type, subtype, balance_current, balance_updated_at')
            .eq('type', 'depository')
            .then(({ data }: any) => setAccounts((data ?? []).filter(isSavingsAccount)))
    }, []))

    const thisYear = transactions.filter(t => dateParts(t.date).year === year)
    const putIn = sumByType(thisYear, 'savings')
    const takenOut = sumByType(thisYear, 'withdrawal')
    const net = putIn - takenOut

    const withBalance = accounts
        .map(a => ({ ...a, balance: a.balance_current === null || a.balance_current === undefined ? null : Number(a.balance_current) }))
        .sort((a, b) => (b.balance ?? -1) - (a.balance ?? -1))
    const total = withBalance.reduce((s, a) => s + (a.balance ?? 0), 0)
    const updated = withBalance.map(a => a.balance_updated_at).filter(Boolean).sort().at(-1)

    if (withBalance.length === 0 && putIn === 0 && takenOut === 0) return null

    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <Text style={styles.title}>Savings</Text>
                {withBalance.length > 0 && <Text style={styles.total}>{formatBalance(total)} in total</Text>}
            </View>
            {withBalance.map(a => (
                <View key={a.id} style={styles.row}>
                    <Text testID="savings-account" style={styles.name}>{`${a.name ?? 'Savings'}${a.last_four ? ` ••${a.last_four}` : ''}`}</Text>
                    <Text style={styles.balance}>{a.balance === null ? '—' : formatBalance(a.balance)}</Text>
                </View>
            ))}
            <Text style={styles.flow}>
                {year}: put in {formatBalance(putIn)} · taken out {formatBalance(takenOut)} · net {net >= 0 ? '+' : '-'}{formatBalance(Math.abs(net))}
            </Text>
            {updated && <Text style={styles.updated}>{updatedAgo(updated)}</Text>}
        </View>
    )
}

const styles = StyleSheet.create({
    card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 0.5, borderColor: '#e0e0e0' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 },
    title: { fontSize: 16, fontWeight: '700', color: '#2c3e50' },
    total: { fontSize: 15, fontWeight: '700', color: '#2980b9' },
    row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 0.5, borderColor: '#f0f0f0' },
    name: { fontSize: 14, color: '#1a1a1a' },
    balance: { fontSize: 14, fontWeight: '600', color: '#2c3e50' },
    flow: { fontSize: 12, color: '#555', marginTop: 8 },
    updated: { fontSize: 11, color: '#aaa', marginTop: 4 },
})
