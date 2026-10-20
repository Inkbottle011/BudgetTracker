import { useState } from 'react'
import { View, TextInput, StyleSheet } from 'react-native'
import { supabase } from '../../../shared/supabase'
import { verifySignInCode } from '../logic/twoFactor'
import { useTheme, useStyles, Palette } from '../../../shared/theme/theme'
import { Button } from '../../../shared/ui/ui'
import { AuthCard, FormMessage } from './AuthScreen'
import { FindYourCode } from './FindYourCode'

/** Shown after the password when two-factor sign-in is on. */
export default function TwoFactorPrompt({ onDone }: { onDone: () => void }) {
    const { c: C } = useTheme()
    const styles = useStyles(makeStyles)
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
        <AuthCard title="Two-factor sign-in" subtitle="Enter the 6-digit code from your authenticator app.">
            <TextInput
                accessibilityLabel="6-digit code"
                style={[styles.input, !!error && styles.inputError]}
                placeholder="123456"
                value={code}
                onChangeText={t => { setCode(t); setError(null) }}
                onSubmitEditing={verify}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={7}
                autoFocus
                placeholderTextColor={C.faint}
            />
            {error ? <FormMessage tone="bad">{error}</FormMessage> : null}
            <Button label="Verify" onPress={verify} loading={loading} style={styles.submit} />
            <FindYourCode />
            <View style={styles.back}>
                <Button variant="ghost" label="Sign out" onPress={() => { supabase.auth.signOut() }} />
            </View>
        </AuthCard>
    )
}

const makeStyles = (C: Palette) => StyleSheet.create({
    input: {
        backgroundColor: C.surfaceAlt, borderRadius: 10, borderWidth: 1, borderColor: C.line, color: C.ink,
        paddingVertical: 12, fontSize: 24, letterSpacing: 8, textAlign: 'center', marginBottom: 14,
    },
    inputError: { borderColor: C.bad },
    submit: { minHeight: 46, marginTop: 2 },
    back: { alignItems: 'center', marginTop: 14 },
})
