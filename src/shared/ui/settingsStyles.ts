import { StyleSheet } from 'react-native'
import type { Palette } from '../theme/theme'

/** Shared bits for the settings sections. */
export const makeSettingsStyles = (C: Palette) => StyleSheet.create({
    help: { fontSize: 14, color: C.muted, lineHeight: 20, marginBottom: 14 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
    start: { alignSelf: 'flex-start' },
    error: { color: C.bad, fontSize: 13, marginTop: 10, lineHeight: 18 },
    confirm: { backgroundColor: C.surfaceAlt, borderRadius: 10, borderWidth: 1, borderColor: C.line, padding: 14, marginTop: 4 },
    confirmText: { fontSize: 14, color: C.text, marginBottom: 12, lineHeight: 20 },
    notice: { fontSize: 14, color: C.muted, lineHeight: 20 },
})
