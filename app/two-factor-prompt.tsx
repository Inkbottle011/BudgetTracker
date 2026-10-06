import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { supabase } from '../lib/supabase'
import { verifySignInCode } from '../lib/twoFactor'

/** Shown after the password when two-factor sign-in is on. */
export default function TwoFactorPrompt({ onDone }: { onDone: () => void }) {
    const [code, setCode] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    async function verify() {
        setLoading(true)
        setError(null)
        try {
            await verifySignInCode(code)
            onDone()
        } catch (e: any) {
            setError(e?.message ?? 'Something went wrong')
        } finally {
            setLoading(false)
        }
    }

    return (
        <View style={styles.container}>
            <View style={styles.card}>
                <Text style={styles.title}>Two-factor sign-in</Text>
                <Text style={styles.subtitle}>Enter the 6-digit code from your authenticator app</Text>
                {error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}
                <TextInput
                    style={styles.input}
                    placeholder="123456"
                    value={code}
                    onChangeText={t => { setCode(t); setError(null) }}
                    onSubmitEditing={verify}
                    keyboardType="number-pad"
                    autoComplete="one-time-code"
                    textContentType="oneTimeCode"
                    maxLength={7}
                    autoFocus
                    placeholderTextColor="#bbb"
                />
                <TouchableOpacity style={[styles.button, loading && { opacity: 0.6 }]} onPress={verify} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => supabase.auth.signOut()} style={styles.link}>
                    <Text style={styles.linkText}>Sign out</Text>
                </TouchableOpacity>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f5f6fa' },
    card: { backgroundColor: '#fff', borderRadius: 20, padding: 28, maxWidth: 420, width: '100%', alignSelf: 'center' },
    title: { fontSize: 24, fontWeight: '700', color: '#2c3e50', textAlign: 'center', marginBottom: 6 },
    subtitle: { fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 20 },
    input: { backgroundColor: '#f8f9fa', borderRadius: 10, padding: 14, fontSize: 24, letterSpacing: 8, textAlign: 'center', borderWidth: 1, borderColor: '#e8e8e8', color: '#1a1a1a' },
    errorBox: { backgroundColor: '#fdedec', borderRadius: 8, padding: 12, marginBottom: 12 },
    errorText: { color: '#e74c3c', fontSize: 13, textAlign: 'center' },
    button: { backgroundColor: '#2c3e50', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 16 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    link: { marginTop: 18, alignItems: 'center' },
    linkText: { color: '#3498db', fontWeight: '600' },
})
