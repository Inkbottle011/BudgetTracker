import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import * as Linking from 'expo-linking'
import { supabase } from '../lib/supabase'

// Only blame the password when Supabase actually says the credentials are wrong.
// Anything else (server errors, network problems) shows the real reason.
function signInErrorMessage(error: { code?: string; status?: number; message: string }): string {
    if (error.code === 'invalid_credentials') return 'Incorrect email or password. Please try again.'
    if (error.code === 'email_not_confirmed') return 'Please confirm your email first. Check your inbox for the confirmation link.'
    if (!error.status) return "Couldn't reach the server. Check your internet connection and try again."
    return `Sign-in failed: ${error.message}`
}

export default function AuthScreen({ initialError }: { initialError?: string | null }) {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [isLogin, setIsLogin] = useState(true)
    const [isForgot, setIsForgot] = useState(false)
    const [loading, setLoading] = useState(false)
    const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>(initialError ? { general: initialError } : {})
    const [success, setSuccess] = useState<string | null>(null)
    const [passwordStrength, setPasswordStrength] = useState(0)
    
    function getPasswordStrength(pwd: string): number {
        let strength = 0
        if (pwd.length >= 8) strength++
        if (/[A-Z]/.test(pwd)) strength++
        if (/[0-9]/.test(pwd)) strength++
        if (/[^A-Za-z0-9]/.test(pwd)) strength++
        return strength
    }
    
    function validate() {
        const newErrors: { email?: string; password?: string } = {}
        
        if (!email) newErrors.email = 'Email is required'
        else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Enter a valid email address'
        
        if (isForgot) {
            // Only the email is needed to request a reset link
        } else if (!password) {
            newErrors.password = 'Password is required'
        } else if (!isLogin) {
            if (password.length < 8) newErrors.password = 'Password must be at least 8 characters'
            else if (!/[A-Z]/.test(password)) newErrors.password = 'Must contain an uppercase letter'
            else if (!/[0-9]/.test(password)) newErrors.password = 'Must contain a number'
            else if (!/[^A-Za-z0-9]/.test(password)) newErrors.password = 'Must contain a special character'
        } else {
            if (password.length < 6) newErrors.password = 'Password must be at least 6 characters'
        }
        
        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }
    
    async function handleAuth() {
        if (!validate()) return
        setLoading(true)
        setErrors({})
        try {
            if (isForgot) {
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    // Where the link in the email sends the user back to (web origin or the app's deep link)
                    redirectTo: Linking.createURL('/'),
                })
                if (error) {
                    setErrors({ general: error.message })
                } else {
                    // Same message whether or not the account exists, so emails can't be probed
                    setSuccess(`If an account exists for ${email}, we've sent a link to reset your password. Check your inbox.`)
                }
            } else if (isLogin) {
                const { error } = await supabase.auth.signInWithPassword({ email, password })
                if (error) setErrors({ general: signInErrorMessage(error) })
            } else {
                const { error } = await supabase.auth.signUp({ email, password })
                if (error) {
                    setErrors({ general: error.message })
                } else {
                    setIsLogin(true)
                    setPassword('')
                    setPasswordStrength(0)
                    setSuccess('Account created! Check your email to confirm before signing in.')
                }
            }
        } catch (e: any) {
            // Never leave the button spinning
            setErrors({ general: `Something went wrong: ${e?.message ?? 'unknown error'}` })
        } finally {
            setLoading(false)
        }
    }
    
    function openForgot(show: boolean) {
        setIsForgot(show)
        setIsLogin(true)
        setErrors({})
        setSuccess(null)
        setPassword('')
        setPasswordStrength(0)
    }
    
    function switchMode() {
        setIsLogin(!isLogin)
        setErrors({})
        setSuccess(null)
        setEmail('')
        setPassword('')
        setPasswordStrength(0)
    }
    
    const strengthLabel = passwordStrength <= 1 ? 'Weak' : passwordStrength === 2 ? 'Fair' : passwordStrength === 3 ? 'Good' : 'Strong'
    const strengthColor = passwordStrength <= 1 ? '#e74c3c' : passwordStrength === 2 ? '#e67e22' : passwordStrength === 3 ? '#f1c40f' : '#27ae60'
    
    return (
        <View style={styles.container}>
        <View style={styles.card}>
        <Text style={styles.title}>Budget Tracker</Text>
        <Text style={styles.subtitle}>
        {isForgot ? "Enter your email and we'll send you a reset link" : isLogin ? 'Sign in to continue' : 'Create your account'}
        </Text>
        
        {errors.general && (
            <View style={styles.generalError}>
            <Text style={styles.generalErrorText}>{errors.general}</Text>
            </View>
        )}
        
        {success && (
            <View style={styles.successBanner}>
            <Text style={styles.successText}>{success}</Text>
            </View>
        )}
        
        <Text style={styles.label}>Email</Text>
        <TextInput
        style={[styles.input, errors.email ? styles.inputError : null]}
        placeholder="you@example.com"
        value={email}
        onChangeText={(t) => { setEmail(t); setErrors(e => ({ ...e, email: undefined })) }}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholderTextColor="#aaa"
        />
        {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
        
        {!isForgot && (<>
        <Text style={styles.label}>Password</Text>
        <View style={[styles.passwordContainer, errors.password ? styles.inputError : null]}>
        <TextInput
        style={styles.passwordInput}
        placeholder={isLogin ? 'Your password' : 'Min. 8 chars, uppercase, number, symbol'}
        value={password}
        onChangeText={(t) => {
            setPassword(t)
            setPasswordStrength(getPasswordStrength(t))
            setErrors(e => ({ ...e, password: undefined }))
        }}
        secureTextEntry={!showPassword}
        placeholderTextColor="#aaa"
        />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
        <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
        </TouchableOpacity>
        </View>
        {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
        
        {!isLogin && password.length > 0 && (
            <View style={styles.strengthContainer}>
            <View style={styles.strengthBar}>
            <View style={[styles.strengthFill, {
                width: `${passwordStrength * 25}%`,
                backgroundColor: strengthColor
            }]} />
            </View>
            <Text style={[styles.strengthText, { color: strengthColor }]}>{strengthLabel}</Text>
            </View>
        )}
        
        {!isLogin && (
            <Text style={styles.hint}>Use at least 8 characters with uppercase, number, and special character</Text>
        )}
        
        {isLogin && (
            <TouchableOpacity onPress={() => openForgot(true)} style={styles.forgotButton}>
            <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
        )}
        </>)}
        
        <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleAuth}
        disabled={loading}
        >
        {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>{isForgot ? 'Send Reset Link' : isLogin ? 'Sign In' : 'Create Account'}</Text>
        }
        </TouchableOpacity>
        
        {isForgot ? (
            <TouchableOpacity onPress={() => openForgot(false)} style={styles.toggleButton}>
            <Text style={styles.toggleLink}>Back to Sign In</Text>
            </TouchableOpacity>
        ) : (
            <TouchableOpacity onPress={switchMode} style={styles.toggleButton}>
            <Text style={styles.toggleText}>
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <Text style={styles.toggleLink}>{isLogin ? 'Sign Up' : 'Sign In'}</Text>
            </Text>
            </TouchableOpacity>
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
    input: { backgroundColor: '#f8f9fa', borderRadius: 10, padding: 14, fontSize: 15, marginBottom: 4, borderWidth: 1, borderColor: '#e8e8e8', color: '#1a1a1a' },
    inputError: { borderColor: '#e74c3c' },
    passwordContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f9fa', borderRadius: 10, borderWidth: 1, borderColor: '#e8e8e8', marginBottom: 4 },
    passwordInput: { flex: 1, padding: 14, fontSize: 15, color: '#1a1a1a' },
    eyeButton: { paddingHorizontal: 14 },
    eyeText: { fontSize: 13, color: '#3498db', fontWeight: '600' },
    errorText: { color: '#e74c3c', fontSize: 12, marginBottom: 12, marginLeft: 2 },
    hint: { color: '#aaa', fontSize: 12, marginBottom: 12, marginLeft: 2 },
    generalError: { backgroundColor: '#fdedec', borderRadius: 8, padding: 12, marginBottom: 16 },
    generalErrorText: { color: '#e74c3c', fontSize: 13, textAlign: 'center' },
    successBanner: { backgroundColor: '#eafaf1', borderRadius: 8, padding: 12, marginBottom: 16 },
    successText: { color: '#27ae60', fontSize: 13, textAlign: 'center', fontWeight: '600' },
    strengthContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, marginTop: 2 },
    strengthBar: { flex: 1, height: 4, backgroundColor: '#e0e0e0', borderRadius: 2, overflow: 'hidden' },
    strengthFill: { height: 4, borderRadius: 2 },
    strengthText: { fontSize: 12, fontWeight: '600', minWidth: 40 },
    button: { backgroundColor: '#2c3e50', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    forgotButton: { alignSelf: 'flex-end', marginBottom: 8, marginTop: 4 },
    forgotText: { fontSize: 13, color: '#3498db', fontWeight: '600' },
    toggleButton: { marginTop: 20, alignItems: 'center' },
    toggleText: { fontSize: 14, color: '#888' },
    toggleLink: { color: '#3498db', fontWeight: '600' },
})