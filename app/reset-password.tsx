import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { supabase } from '../lib/supabase'

// Shown after the user opens the reset link from their email.
// At this point Supabase has signed them in with a temporary recovery session.
export default function ResetPasswordScreen({ onDone }: { onDone: () => void }) {
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    function validate(): string | null {
        if (password.length < 8) return 'Password must be at least 8 characters'
        if (!/[A-Z]/.test(password)) return 'Must contain an uppercase letter'
        if (!/[0-9]/.test(password)) return 'Must contain a number'
        if (!/[^A-Za-z0-9]/.test(password)) return 'Must contain a special character'
        if (password !== confirm) return 'Passwords do not match'
        return null
    }

    async function handleSave() {
        const problem = validate()
        if (problem) { setError(problem); return }
        setLoading(true)
        setError(null)
        try {
            const { error } = await supabase.auth.updateUser({ password })
            if (error) setError(error.message)
            else setSuccess(true)
        } catch (e: any) {
            setError(`Something went wrong: ${e?.message ?? 'unknown error'}`)
        } finally {
            setLoading(false)
        }
    }

    async function handleCancel() {
        // Don't leave them signed in on a recovery session they didn't finish
        await supabase.auth.signOut()
        onDone()
    }

    return (
        <View style={styles.container}>
        <View style={styles.card}>
        <Text style={styles.title}>Reset Password</Text>

        {success ? (
            <>
            <View style={styles.successBanner}>
            <Text style={styles.successText}>Your password has been updated.</Text>
            </View>
            <TouchableOpacity style={styles.button} onPress={onDone}>
            <Text style={styles.buttonText}>Continue</Text>
            </TouchableOpacity>
            </>
        ) : (
            <>
            <Text style={styles.subtitle}>Choose a new password for your account</Text>

            {error && (
                <View style={styles.generalError}>
                <Text style={styles.generalErrorText}>{error}</Text>
                </View>
            )}

            <Text style={styles.label}>New password</Text>
            <View style={styles.passwordContainer}>
            <TextInput
            style={styles.passwordInput}
            placeholder="Min. 8 chars, uppercase, number, symbol"
            value={password}
            onChangeText={(t) => { setPassword(t); setError(null) }}
            secureTextEntry={!showPassword}
            placeholderTextColor="#aaa"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
            <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
            </View>

            <Text style={styles.label}>Confirm new password</Text>
            <TextInput
            style={styles.input}
            placeholder="Re-enter new password"
            value={confirm}
            onChangeText={(t) => { setConfirm(t); setError(null) }}
            secureTextEntry={!showPassword}
            placeholderTextColor="#aaa"
            />

            <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={loading}
            >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Update Password</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={handleCancel} style={styles.toggleButton}>
            <Text style={styles.toggleLink}>Cancel</Text>
            </TouchableOpacity>
            </>
        )}
        </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f5f6fa' },
    card: { backgroundColor: '#fff', borderRadius: 20, padding: 28, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
    title: { fontSize: 28, fontWeight: '700', color: '#2c3e50', textAlign: 'center', marginBottom: 6 },
    subtitle: { fontSize: 15, color: '#888', textAlign: 'center', marginBottom: 24 },
    label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6 },
    input: { backgroundColor: '#f8f9fa', borderRadius: 10, padding: 14, fontSize: 15, marginBottom: 12, borderWidth: 1, borderColor: '#e8e8e8', color: '#1a1a1a' },
    passwordContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f9fa', borderRadius: 10, borderWidth: 1, borderColor: '#e8e8e8', marginBottom: 12 },
    passwordInput: { flex: 1, padding: 14, fontSize: 15, color: '#1a1a1a' },
    eyeButton: { paddingHorizontal: 14 },
    eyeText: { fontSize: 13, color: '#3498db', fontWeight: '600' },
    generalError: { backgroundColor: '#fdedec', borderRadius: 8, padding: 12, marginBottom: 16 },
    generalErrorText: { color: '#e74c3c', fontSize: 13, textAlign: 'center' },
    successBanner: { backgroundColor: '#eafaf1', borderRadius: 8, padding: 12, marginBottom: 16, marginTop: 12 },
    successText: { color: '#27ae60', fontSize: 13, textAlign: 'center', fontWeight: '600' },
    button: { backgroundColor: '#2c3e50', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    toggleButton: { marginTop: 20, alignItems: 'center' },
    toggleLink: { color: '#3498db', fontWeight: '600', fontSize: 14 },
})
