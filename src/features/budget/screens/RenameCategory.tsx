// Renaming a budget item, and the transactions and subscriptions that use it. Renaming it to a name you
// already have combines the two.
import { useState } from 'react'
import { Modal, View, Text, StyleSheet } from 'react-native'
import { useStyles, Palette } from '../../../shared/theme/theme'
import { Button, Field } from '../../../shared/ui/ui'
import { BudgetItem } from '../logic/types'

export function RenameCategory({ item, items, onClose, onRename }: {
    item: BudgetItem
    items: BudgetItem[]
    onClose: () => void
    /** `into` is set when the new name is another item you have: the two are combined */
    onRename: (name: string, into: BudgetItem | null) => Promise<void>
}) {
    const s = useStyles(makeStyles)
    const [name, setName] = useState(item.name)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const clean = name.trim()
    const into = items.find(i => i.id !== item.id && i.type === item.type && i.name.trim().toLowerCase() === clean.toLowerCase()) ?? null
    const unchanged = clean === item.name.trim()

    async function go() {
        setBusy(true)
        setError(null)
        try { await onRename(clean, into) } catch (e: any) { setError(e?.message ?? "Couldn't rename it"); setBusy(false) }
    }

    return (
        <Modal visible transparent animationType="fade" onRequestClose={onClose}>
            <View style={s.overlay}>
                <View style={s.card}>
                    <Text style={s.title} accessibilityRole="header">Rename {item.name}</Text>
                    <Field label="New name" value={name} onChangeText={setName} autoFocus onSubmitEditing={() => { if (clean && !unchanged) go() }}
                        hint={into ? undefined : 'Its transactions and subscriptions get the new name too.'} />
                    {into && (
                        <Text style={s.note}>
                            You already have {into.name}. {item.name}'s transactions, subscriptions and planned amounts will be combined into it.
                        </Text>
                    )}
                    {error && <Text style={s.error}>{error}</Text>}
                    <View style={s.buttons}>
                        <Button variant="secondary" label="Cancel" onPress={onClose} disabled={busy} />
                        <Button label={into ? `Combine into ${into.name}` : 'Rename'} onPress={go} loading={busy} disabled={!clean || unchanged} />
                    </View>
                </View>
            </View>
        </Modal>
    )
}

const makeStyles = (C: Palette) => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: C.scrim, justifyContent: 'center', alignItems: 'center', padding: 20 },
    card: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 22, width: '100%', maxWidth: 440 },
    title: { fontSize: 18, fontWeight: '700', color: C.ink, marginBottom: 14 },
    note: { fontSize: 13, color: C.warn, fontWeight: '600', lineHeight: 18, marginBottom: 10 },
    error: { fontSize: 13, color: C.bad, fontWeight: '600', marginBottom: 10 },
    buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 6 },
})
