// "Where's my code?" help for two-factor sign-in, with steps for iPhone or Android.
import { useState } from 'react'
import { View, Text, Platform, StyleSheet } from 'react-native'
import { useStyles, Palette } from '../lib/theme'
import { Segmented } from './ui'

export type Phone = 'iphone' | 'android'
export const PHONES: { value: Phone; label: string }[] = [{ value: 'iphone', label: 'iPhone' }, { value: 'android', label: 'Android' }]

/** Best guess at the kind of phone, so the right steps show first. */
export function guessPhone(): Phone {
    if (Platform.OS === 'android') return 'android'
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent ?? '' : ''
    return /android/i.test(ua) ? 'android' : 'iphone'
}

const FIND_STEPS: Record<Phone, string[]> = {
    iphone: [
        'Open the Passwords app (on older iPhones: Settings → Passwords).',
        'Tap Codes.',
        "Find the Budget Tracker entry (it may be listed under this website's address) and type its 6-digit code above.",
    ],
    android: [
        'Open Google Authenticator.',
        "Find Budget Tracker in the list (it may be listed under this website's address).",
        'Type its 6-digit code above.',
    ],
}

/** Shown on the sign-in code screen. */
export function FindYourCode() {
    const styles = useStyles(makeStyles)
    const [phone, setPhone] = useState<Phone>(guessPhone)
    return (
        <View style={styles.box}>
            <View style={styles.head}>
                <Text style={styles.title}>Where to find your code</Text>
                <Segmented<Phone> value={phone} onChange={setPhone} options={PHONES} />
            </View>
            {FIND_STEPS[phone].map((line, i) => (
                <View key={`${phone}${i}`} style={styles.step}>
                    <Text style={styles.num}>{i + 1}.</Text>
                    <Text style={styles.text}>{line}</Text>
                </View>
            ))}
            {phone === 'iphone' && (
                <Text style={styles.note}>Signing in on your iPhone? The code may also appear above the keyboard; tap it to fill it in.</Text>
            )}
            <Text style={styles.note}>The code changes every 30 seconds. If it runs out while you type, use the new one.</Text>
            <Text style={styles.note}>
                <Text style={styles.bold}>Can't find it? </Text>
                Check the phone or app you used when you turned on two-factor sign-in. If you no longer have it, two-factor
                sign-in has to be reset for your account before you can sign in.
            </Text>
        </View>
    )
}

const makeStyles = (C: Palette) => StyleSheet.create({
    box: { backgroundColor: C.surfaceAlt, borderRadius: 12, borderWidth: 1, borderColor: C.line, padding: 14, marginTop: 16, gap: 8 },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 2 },
    title: { fontSize: 14, fontWeight: '700', color: C.ink },
    step: { flexDirection: 'row', gap: 6 },
    num: { fontSize: 14, color: C.muted, lineHeight: 20, width: 16 },
    text: { fontSize: 14, color: C.text, lineHeight: 20, flex: 1 },
    note: { fontSize: 13, color: C.muted, lineHeight: 19 },
    bold: { fontWeight: '700', color: C.text },
})
