// "Are you sure?" before something is deleted, as a small card over the page.
import { Modal, View, Text, StyleSheet } from 'react-native'
import { useStyles } from '../theme/theme'
import type { Palette } from '../theme/themes'
import { Button } from './ui'

export function ConfirmDialog({ visible, title, message, confirmLabel, onConfirm, onCancel, busy }: {
    visible: boolean
    title: string
    message?: string
    confirmLabel: string
    onConfirm: () => void
    onCancel: () => void
    busy?: boolean
}) {
    const s = useStyles(makeStyles)
    if (!visible) return null
    return (
        <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
            <View style={s.overlay}>
                <View style={s.card} accessibilityRole="alert">
                    <Text style={s.title} accessibilityRole="header">{title}</Text>
                    {message && <Text style={s.message}>{message}</Text>}
                    <View style={s.buttons}>
                        <Button variant="secondary" label="Cancel" onPress={onCancel} disabled={busy} />
                        <Button variant="danger" label={confirmLabel} onPress={onConfirm} loading={busy} />
                    </View>
                </View>
            </View>
        </Modal>
    )
}

const makeStyles = (C: Palette) => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: C.scrim, justifyContent: 'center', alignItems: 'center', padding: 20 },
    card: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 22, width: '100%', maxWidth: 420, gap: 10 },
    title: { fontSize: 18, fontWeight: '700', color: C.ink },
    message: { fontSize: 14, color: C.text, lineHeight: 20 },
    buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
})
