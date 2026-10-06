import { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet } from 'react-native'
import { twoFactorStatus, startTwoFactorSetup, verifyCode, turnOffTwoFactor } from '../lib/twoFactor'
import { useToastContext } from '../context/ToastContext'

/** Settings: turn two-factor sign-in on or off. Reports changes so other sections can react. */
export function TwoFactorSection({ onChange }: { onChange: (on: boolean) => void }) {
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

    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <Text style={styles.title}>Two-factor sign-in</Text>
                {status && <Text style={[styles.badge, status.on ? styles.on : styles.off]}>{status.on ? 'On' : 'Off'}</Text>}
            </View>
            <Text style={styles.help}>
                Asks for a code from an authenticator app (like Google Authenticator or 1Password) when you sign in. Required for linking banks.
            </Text>

            {status && !status.on && !setup && (
                <TouchableOpacity style={styles.primary} onPress={begin} disabled={busy}>
                    <Text style={styles.primaryText}>Set up two-factor sign-in</Text>
                </TouchableOpacity>
            )}

            {setup && (
                <View style={styles.setup}>
                    <Text style={styles.step}>1. Scan this with your phone</Text>
                    <Image accessibilityLabel="QR code for your authenticator app" source={{ uri: setup.qrCode }} style={styles.qr} />
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
                            style={styles.codeInput}
                            placeholder="123456"
                            value={code}
                            onChangeText={t => { setCode(t); setError(null) }}
                            onSubmitEditing={confirm}
                            keyboardType="number-pad"
                            maxLength={7}
                            placeholderTextColor="#bbb"
                        />
                        <TouchableOpacity style={styles.primary} onPress={confirm} disabled={busy}>
                            <Text style={styles.primaryText}>Confirm</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => { setSetup(null); setCode(''); setError(null) }}>
                            <Text style={styles.link}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {status?.on && !confirmOff && (
                <TouchableOpacity onPress={() => setConfirmOff(true)}>
                    <Text style={styles.link}>Turn off</Text>
                </TouchableOpacity>
            )}
            {confirmOff && (
                <View style={styles.confirm}>
                    <Text style={styles.confirmText}>Turn off two-factor sign-in? Linked banks will stop syncing until you turn it back on.</Text>
                    <View style={styles.row}>
                        <TouchableOpacity style={styles.danger} onPress={turnOff} disabled={busy}><Text style={styles.dangerText}>Yes, turn off</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => setConfirmOff(false)}><Text style={styles.link}>Keep it on</Text></TouchableOpacity>
                    </View>
                </View>
            )}

            {error && <Text style={styles.error}>{error}</Text>}
        </View>
    )
}

export const settingsCardStyles = StyleSheet.create({
    card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 0.5, borderColor: '#e0e0e0' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
    title: { fontSize: 16, fontWeight: '700', color: '#2c3e50' },
    help: { fontSize: 13, color: '#777', lineHeight: 18, marginBottom: 12 },
    primary: { backgroundColor: '#2c3e50', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9, alignSelf: 'flex-start' },
    primaryText: { color: '#fff', fontWeight: '600', fontSize: 13 },
    link: { color: '#3498db', fontWeight: '600', fontSize: 13 },
    danger: { backgroundColor: '#fdedec', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
    dangerText: { color: '#e74c3c', fontWeight: '600', fontSize: 13 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
    error: { color: '#e74c3c', fontSize: 13, marginTop: 10 },
    confirm: { backgroundColor: '#fafafa', borderRadius: 8, padding: 12, marginTop: 4 },
    confirmText: { fontSize: 13, color: '#555', marginBottom: 10 },
})

const styles = StyleSheet.create({
    ...settingsCardStyles,
    badge: { fontSize: 12, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
    on: { backgroundColor: '#eafaf1', color: '#1e8449' },
    off: { backgroundColor: '#f2f3f4', color: '#7f8c8d' },
    setup: { gap: 8 },
    step: { fontSize: 13, color: '#2c3e50', fontWeight: '600', marginTop: 4 },
    qr: { width: 180, height: 180, backgroundColor: '#fff' },
    howTo: { backgroundColor: '#f4f8fb', borderRadius: 8, padding: 10, gap: 6 },
    howToLine: { fontSize: 13, color: '#555', lineHeight: 18 },
    howToBold: { fontWeight: '700', color: '#2c3e50' },
    secret: { fontFamily: 'monospace', fontSize: 14, letterSpacing: 1, color: '#1a1a1a', backgroundColor: '#f8f9fa', padding: 8, borderRadius: 6, alignSelf: 'flex-start' },
    codeInput: { backgroundColor: '#f8f9fa', borderRadius: 8, padding: 10, fontSize: 18, letterSpacing: 4, width: 140, borderWidth: 1, borderColor: '#e8e8e8', color: '#1a1a1a' },
})
