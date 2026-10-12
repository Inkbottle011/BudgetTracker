import { useEffect, useState } from 'react'
import { View, Text, TextInput, Image, StyleSheet } from 'react-native'
import { twoFactorStatus, startTwoFactorSetup, verifyCode, turnOffTwoFactor } from '../lib/twoFactor'
import { useToastContext } from '../context/ToastContext'
import { useTheme, useStyles, Palette, light } from '../lib/theme'
import { Section, Button } from './ui'

/** Settings: turn two-factor sign-in on or off. Reports changes so other sections can react. */
export function TwoFactorSection({ onChange }: { onChange: (on: boolean) => void }) {
    const { c: C } = useTheme()
    const styles = useStyles(makeStyles)
    const { showToast } = useToastContext()
    const [status, setStatus] = useState<{ on: boolean; factorId: string | null } | null>(null)
    const [setup, setSetup] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null)
    const [code, setCode] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [confirmOff, setConfirmOff] = useState(false)
    const [busy, setBusy] = useState(false)

    async function refresh() {
        try {
            const s = await twoFactorStatus()
            setStatus(s)
            onChange(s.on)
        } catch (e: any) {
            setError(e?.message ?? "Couldn't check two-factor sign-in")
        }
    }
    useEffect(() => { refresh() }, [])

    async function begin() {
        setBusy(true); setError(null)
        try { setSetup(await startTwoFactorSetup()) } catch (e: any) { setError(e?.message) }
        setBusy(false)
    }

    async function confirm() {
        if (!setup) return
        setBusy(true); setError(null)
        try {
            await verifyCode(setup.factorId, code)
            setSetup(null); setCode('')
            await refresh()
            showToast('Two-factor sign-in is on')
        } catch (e: any) {
            setError(e?.message)
        }
        setBusy(false)
    }

    async function turnOff() {
        if (!status?.factorId) return
        setBusy(true); setError(null)
        try {
            await turnOffTwoFactor(status.factorId)
            setConfirmOff(false)
            await refresh()
            showToast('Two-factor sign-in is off')
        } catch (e: any) {
            setError(e?.message)
        }
        setBusy(false)
    }

    const badge = status && (
        <View style={[styles.badge, status.on ? styles.badgeOn : styles.badgeOff]}>
            <Text style={[styles.badgeText, { color: status.on ? C.good : C.muted }]}>{status.on ? 'On' : 'Off'}</Text>
        </View>
    )

    return (
        <Section title="Two-factor sign-in" action={badge}>
            <Text style={styles.help}>
                Asks for a code from an authenticator app (like Google Authenticator or 1Password) when you sign in. Required for linking banks.
            </Text>

            {status && !status.on && !setup && (
                <Button label="Set up two-factor sign-in" onPress={begin} loading={busy} style={styles.start} />
            )}

            {setup && (
                <View style={styles.setup}>
                    <Text style={styles.step}>1. Scan this with your phone</Text>
                    <View style={styles.qrFrame}>
                        <Image accessibilityLabel="QR code for your authenticator app" source={{ uri: setup.qrCode }} style={styles.qr} />
                    </View>
                    <View style={styles.howTo}>
                        <Text style={styles.howToLine}>
                            <Text style={styles.howToBold}>iPhone: </Text>
                            open the Camera app, point it at the code (no photo needed) and tap "Add Verification Code in Passwords".
                            Save it as a new entry called Budget Tracker.
                        </Text>
                        <Text style={styles.howToLine}>
                            <Text style={styles.howToBold}>Android: </Text>
                            install Google Authenticator, tap +, then "Scan a QR code".
                        </Text>
                        <Text style={styles.howToLine}>
                            Next time you sign in, get the code from the Passwords app (Codes tab) on iPhone, or from Google Authenticator.
                        </Text>
                    </View>
                    <Text style={styles.step}>Or type this key into the app:</Text>
                    <Text selectable style={styles.secret}>{setup.secret}</Text>
                    <Text style={styles.step}>2. Enter the 6-digit code it shows (it changes every 30 seconds)</Text>
                    <View style={styles.row}>
                        <TextInput
                            accessibilityLabel="6-digit code"
                            style={[styles.codeInput, !!error && { borderColor: C.bad }]}
                            placeholder="123456"
                            value={code}
                            onChangeText={t => { setCode(t); setError(null) }}
                            onSubmitEditing={confirm}
                            keyboardType="number-pad"
                            maxLength={7}
                            placeholderTextColor={C.faint}
                        />
                        <Button label="Confirm" onPress={confirm} loading={busy} />
                        <Button variant="ghost" label="Cancel" onPress={() => { setSetup(null); setCode(''); setError(null) }} />
                    </View>
                </View>
            )}

            {status?.on && !confirmOff && (
                <Button variant="secondary" small label="Turn off" onPress={() => setConfirmOff(true)} style={styles.start} />
            )}
            {confirmOff && (
                <View style={styles.confirm}>
                    <Text style={styles.confirmText}>Turn off two-factor sign-in? Linked banks will stop syncing until you turn it back on.</Text>
                    <View style={styles.row}>
                        <Button variant="danger" small label="Yes, turn off" onPress={turnOff} loading={busy} />
                        <Button variant="ghost" small label="Keep it on" onPress={() => setConfirmOff(false)} />
                    </View>
                </View>
            )}

            {error && <Text style={styles.error}>{error}</Text>}
        </Section>
    )
}

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

const makeStyles = (C: Palette) => StyleSheet.create({
    ...makeSettingsStyles(C),
    badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
    badgeOn: { backgroundColor: C.goodSoft },
    badgeOff: { backgroundColor: C.track },
    badgeText: { fontSize: 12, fontWeight: '600' },
    setup: { gap: 10 },
    step: { fontSize: 14, color: C.ink, fontWeight: '600', marginTop: 4 },
    // The QR code needs a white quiet zone to scan, even in dark mode
    qrFrame: { alignSelf: 'flex-start', backgroundColor: light.surface, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: C.line },
    qr: { width: 180, height: 180 },
    howTo: { backgroundColor: C.primarySoft, borderRadius: 10, padding: 12, gap: 8 },
    howToLine: { fontSize: 13, color: C.text, lineHeight: 19 },
    howToBold: { fontWeight: '700', color: C.ink },
    secret: {
        fontFamily: 'monospace', fontSize: 14, letterSpacing: 1, color: C.ink, backgroundColor: C.surfaceAlt,
        borderWidth: 1, borderColor: C.line, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, alignSelf: 'flex-start',
    },
    codeInput: {
        backgroundColor: C.surfaceAlt, borderRadius: 10, borderWidth: 1, borderColor: C.line, color: C.ink,
        paddingHorizontal: 12, paddingVertical: 8, fontSize: 18, letterSpacing: 4, width: 140,
    },
})
