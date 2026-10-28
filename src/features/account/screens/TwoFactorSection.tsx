import { useEffect, useState } from 'react'
import { View, Text, TextInput, Image, StyleSheet, Platform } from 'react-native'
import { twoFactorStatus, startTwoFactorSetup, verifyCode, turnOffTwoFactor, removeAuthenticator, type Authenticator } from '../logic/twoFactor'
import { useToastContext } from '../../../shared/ui/ToastContext'
import { useTheme, useStyles, Palette, light } from '../../../shared/theme/theme'
import { Section, Button, Segmented } from '../../../shared/ui/ui'
import { makeSettingsStyles } from '../../../shared/ui/settingsStyles'
import { guessPhone, PHONES, type Phone } from './FindYourCode'

// The steps for each kind of phone
const STEPS: Record<Phone, { app: string; scan: string[]; key: string; later: string }> = {
    iphone: {
        app: "Nothing to install: use the iPhone's built-in Passwords app (on older iPhones it's in Settings → Passwords).",
        scan: [
            'Open the Camera app and point it at the square code below. No need to take a photo.',
            'Tap the yellow "Add Verification Code in Passwords" button that pops up.',
            'Pick your Budget Tracker login if it\'s listed, or make a new entry called Budget Tracker, then tap Save.',
        ],
        key: 'Open the Passwords app, tap Codes, tap +, choose "Enter Setup Key", name it Budget Tracker and paste the key.',
        later: 'Each time you sign in, open the Passwords app, tap Codes, and type the code shown for Budget Tracker.',
    },
    android: {
        app: 'Install Google Authenticator from the Play Store (free).',
        scan: [
            'Open Google Authenticator and tap + (bottom right).',
            'Tap "Scan a QR code" and point your camera at the square code below.',
            'Budget Tracker is added to the list.',
        ],
        key: 'In Google Authenticator tap +, choose "Enter a setup key", name it Budget Tracker, paste the key, and tap Add.',
        later: 'Each time you sign in, open Google Authenticator and type the code shown for Budget Tracker.',
    },
}

/** Settings: turn two-factor sign-in on or off. Reports changes so other sections can react. */
export function TwoFactorSection({ onChange }: { onChange: (on: boolean) => void }) {
    const { c: C } = useTheme()
    const styles = useStyles(makeStyles)
    const { showToast } = useToastContext()
    const [status, setStatus] = useState<Awaited<ReturnType<typeof twoFactorStatus>> | null>(null)
    const [setup, setSetup] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null)
    const [code, setCode] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [confirmOff, setConfirmOff] = useState(false)
    const [confirmRemove, setConfirmRemove] = useState<Authenticator | null>(null)
    const [busy, setBusy] = useState(false)
    const [phone, setPhone] = useState<Phone>(guessPhone)
    const [copied, setCopied] = useState(false)
    const canCopy = Platform.OS === 'web' && typeof navigator !== 'undefined' && !!navigator.clipboard
    const steps = STEPS[phone]

    async function copyKey() {
        if (!setup) return
        try { await navigator.clipboard.writeText(setup.secret); setCopied(true) } catch { /* the key can still be selected by hand */ }
    }

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
            const wasOn = !!status?.on
            await verifyCode(setup.factorId, code)
            setSetup(null); setCode('')
            await refresh()
            showToast(wasOn ? 'Backup authenticator added' : 'Two-factor sign-in is on')
        } catch (e: any) {
            setError(e?.message)
        }
        setBusy(false)
    }

    async function remove(a: Authenticator) {
        setBusy(true); setError(null)
        try {
            await removeAuthenticator(a.id)
            setConfirmRemove(null)
            await refresh()
            showToast(`${a.name} removed`)
        } catch (e: any) {
            setError(e?.message)
        }
        setBusy(false)
    }

    async function turnOff() {
        if (!status?.on) return
        setBusy(true); setError(null)
        try {
            await turnOffTwoFactor()
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
                    <Text style={styles.intro}>Takes about a minute. Have your phone ready.</Text>
                    <Segmented<Phone> value={phone} onChange={setPhone} options={PHONES} />

                    <Text style={styles.step}>1. Get an authenticator app</Text>
                    <Text style={styles.body}>{steps.app}</Text>

                    <Text style={styles.step}>2. Add Budget Tracker to it</Text>
                    {steps.scan.map((line, i) => (
                        <View key={i} style={styles.bullet}>
                            <Text style={styles.bulletMark}>{String.fromCharCode(97 + i)}.</Text>
                            <Text style={styles.bulletText}>{line}</Text>
                        </View>
                    ))}
                    <View style={styles.qrFrame}>
                        <Image accessibilityLabel="QR code for your authenticator app" source={{ uri: setup.qrCode }} style={styles.qr} />
                    </View>
                    <View style={styles.howTo}>
                        <Text style={styles.howToLine}>
                            <Text style={styles.howToBold}>Reading this on the same phone? </Text>
                            You can't scan your own screen, so use this key instead. {steps.key}
                        </Text>
                        <View style={styles.row}>
                            <Text selectable style={styles.secret}>{setup.secret}</Text>
                            {canCopy && <Button variant="secondary" small label={copied ? 'Copied' : 'Copy key'} onPress={copyKey} />}
                        </View>
                    </View>

                    <Text style={styles.step}>3. Type the code it shows</Text>
                    <Text style={styles.body}>
                        The app now shows a 6-digit code for Budget Tracker. It changes every 30 seconds; if it changes while you're typing, just use the new one.
                    </Text>
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
                        <Button variant="ghost" label="Cancel" onPress={() => { setSetup(null); setCode(''); setError(null); setCopied(false) }} />
                    </View>
                    <Text style={styles.later}>{steps.later}</Text>
                </View>
            )}

            {status?.on && !setup && (
                <View style={styles.authList}>
                    <Text style={styles.listTitle}>Your authenticators</Text>
                    {status.authenticators.map(a => (
                        <View key={a.id} style={styles.authRow}>
                            <Text style={styles.authName}>{a.name}</Text>
                            {status.authenticators.length > 1 && confirmRemove?.id !== a.id && (
                                <Button variant="ghost" small label="Remove" accessibilityLabel={`Remove ${a.name}`} onPress={() => setConfirmRemove(a)} />
                            )}
                        </View>
                    ))}
                    {confirmRemove && (
                        <View style={styles.confirm}>
                            <Text style={styles.confirmText}>Remove {confirmRemove.name}? You can still sign in with your other authenticator. This can't be undone: to use it again you'd add it again.</Text>
                            <View style={styles.row}>
                                <Button variant="danger" small label="Yes, remove" onPress={() => remove(confirmRemove)} loading={busy} />
                                <Button variant="ghost" small label="Keep it" onPress={() => setConfirmRemove(null)} />
                            </View>
                        </View>
                    )}
                    <Text style={styles.backupHelp}>
                        Add a second one, like another phone or a password manager, so you can still sign in if you lose your phone.
                    </Text>
                    <Button variant="secondary" small label={status.authenticators.length > 1 ? 'Add another authenticator' : 'Add a backup authenticator'}
                        accessibilityLabel={status.authenticators.length > 1 ? 'Add another authenticator' : 'Add a backup authenticator'}
                        onPress={begin} loading={busy} style={styles.start} />
                </View>
            )}
            {status?.on && !confirmOff && !setup && (
                <Button variant="secondary" small label="Turn off" onPress={() => setConfirmOff(true)} style={styles.start} />
            )}
            {confirmOff && (
                <View style={styles.confirm}>
                    <Text style={styles.confirmText}>Turn off two-factor sign-in? Linked banks will stop syncing until you turn it back on. This can't be undone: to turn it back on you'd set up your authenticator again.</Text>
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

const makeStyles = (C: Palette) => StyleSheet.create({
    ...makeSettingsStyles(C),
    badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
    authList: { gap: 6, marginBottom: 14 },
    listTitle: { fontSize: 14, fontWeight: '700', color: C.ink },
    authRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderColor: C.line },
    authName: { fontSize: 14, color: C.text },
    backupHelp: { fontSize: 13, color: C.muted, lineHeight: 18, marginTop: 6 },
    badgeOn: { backgroundColor: C.goodSoft },
    badgeOff: { backgroundColor: C.track },
    badgeText: { fontSize: 12, fontWeight: '600' },
    setup: { gap: 10 },
    step: { fontSize: 15, color: C.ink, fontWeight: '700', marginTop: 8 },
    intro: { fontSize: 14, color: C.text, lineHeight: 20 },
    body: { fontSize: 14, color: C.text, lineHeight: 20 },
    bullet: { flexDirection: 'row', gap: 8, paddingLeft: 4 },
    bulletMark: { fontSize: 14, color: C.muted, lineHeight: 20, width: 16 },
    bulletText: { fontSize: 14, color: C.text, lineHeight: 20, flex: 1 },
    later: { fontSize: 13, color: C.muted, lineHeight: 19, marginTop: 4 },
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
