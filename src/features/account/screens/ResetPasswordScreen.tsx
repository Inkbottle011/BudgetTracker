import { useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { supabase } from '../../../shared/supabase'
import { Button } from '../../../shared/ui/ui'
import { AuthCard, FormMessage, PasswordField } from './AuthScreen'

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

    if (success) {
        return (
            <AuthCard title="Password changed">
                <FormMessage tone="good">Your password has been updated.</FormMessage>
                <Button label="Continue" onPress={onDone} style={styles.submit} />
            </AuthCard>
        )
    }

    return (
        <AuthCard title="Choose a new password" subtitle="Pick a password you haven't used here before.">
            <PasswordField
                label="New password"
                placeholder="Min. 8 chars, uppercase, number, symbol"
                value={password}
                onChangeText={(t) => { setPassword(t); setError(null) }}
                hint="At least 8 characters with an uppercase letter, a number and a symbol."
                shown={showPassword}
                onToggle={() => setShowPassword(s => !s)}
            />
            <PasswordField
                label="Confirm new password"
                placeholder="Re-enter new password"
                value={confirm}
                onChangeText={(t) => { setConfirm(t); setError(null) }}
                shown={showPassword}
                onSubmitEditing={handleSave}
            />

            {error ? <FormMessage tone="bad">{error}</FormMessage> : null}

            <Button label="Save new password" onPress={handleSave} loading={loading} style={styles.submit} />
            <View style={styles.back}>
                <Button variant="ghost" label="Cancel" onPress={handleCancel} />
            </View>
        </AuthCard>
    )
}

const styles = StyleSheet.create({
    submit: { minHeight: 46, marginTop: 4 },
    back: { alignItems: 'center', marginTop: 14 },
})
