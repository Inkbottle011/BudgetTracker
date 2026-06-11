import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { supabase } from '../lib/supabase'

export default function AuthScreen() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [isLogin, setIsLogin] = useState(true)
    const [loading, setLoading] = useState(false)
    const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({})
    const [success, setSuccess] = useState<string | null>(null)
    
    function validate() {
        const newErrors: { email?: string; password?: string } = {}
        if (!email) newErrors.email = 'Email is required'
        else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Enter a valid email address'
        if (!password) newErrors.password = 'Password is required'
        else if (password.length < 6) newErrors.password = 'Password must be at least 6 characters'
        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }
    
    async function handleAuth() {
        if (!validate()) return
        setLoading(true)
        setErrors({})
        
        if (isLogin) {
            const { error } = await supabase.auth.signInWithPassword({ email, password })
            if (error) setErrors({ general: 'Incorrect email or password. Please try again.' })
            } else {
            const { error } = await supabase.auth.signUp({ email, password })
            if (error) {
                setErrors({ general: error.message })
            } else {
                setIsLogin(true)
                setPassword('')
                setErrors({ general: undefined })
                // Show success message by setting a success state
                setSuccess('Account created! Please sign in.')
            }
        }
        setLoading(false)
    }
    
    function switchMode() {
        setIsLogin(!isLogin)
        setErrors({})
        setSuccess(null)
        setEmail('')
        setPassword('')
    }
    
    return (
        <View style={styles.container}>
        <View style={styles.card}>
        <Text style={styles.title}>Budget Tracker</Text>
        <Text style={styles.subtitle}>{isLogin ? 'Sign in to continue' : 'Create your account'}</Text>
        
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
        
        <Text style={styles.label}>Password</Text>
        <View style={[styles.passwordContainer, errors.password ? styles.inputError : null]}>
        <TextInput
        style={styles.passwordInput}
        placeholder="Min. 6 characters"
        value={password}
        onChangeText={(t) => { setPassword(t); setErrors(e => ({ ...e, password: undefined })) }}
        secureTextEntry={!showPassword}
        placeholderTextColor="#aaa"
        />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
        <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
        </TouchableOpacity>
        </View>
        {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
        {!isLogin && (
            <Text style={styles.hint}>Use at least 6 characters with a mix of letters and numbers</Text>
        )}
        
        <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleAuth}
        disabled={loading}
        >
        {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>{isLogin ? 'Sign In' : 'Create Account'}</Text>
        }
        </TouchableOpacity>
        
        <TouchableOpacity onPress={switchMode} style={styles.toggleButton}>
        <Text style={styles.toggleText}>
        {isLogin ? "Don't have an account? " : 'Already have an account? '}
        <Text style={styles.toggleLink}>{isLogin ? 'Sign Up' : 'Sign In'}</Text>
        </Text>
        </TouchableOpacity>
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
    button: { backgroundColor: '#2c3e50', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    toggleButton: { marginTop: 20, alignItems: 'center' },
    toggleText: { fontSize: 14, color: '#888' },
    toggleLink: { color: '#3498db', fontWeight: '600' },
    successBanner: { backgroundColor: '#eafaf1', borderRadius: 8, padding: 12, marginBottom: 16 },
    successText: { color: '#2ecc71', fontSize: 13, textAlign: 'center', fontWeight: '600' },
})