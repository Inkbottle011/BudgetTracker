import { useEffect, useRef } from 'react'
import { Animated, Text, StyleSheet, View } from 'react-native'

export type ToastType = 'success' | 'error' | 'info'

interface ToastProps {
    message: string
    type?: ToastType
    visible: boolean
    onHide: () => void
    duration?: number
}

export function Toast({ message, type = 'success', visible, onHide, duration = 3000 }: ToastProps) {
    const opacity = useRef(new Animated.Value(0)).current
    
    useEffect(() => {
        if (visible) {
            Animated.sequence([
                Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
                Animated.delay(duration),
                Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
            ]).start(() => onHide())
        }
    }, [visible])
    
    if (!visible) return null
    
    const bgColor = type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#2980b9'
    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'
    
    return (
        <Animated.View style={[styles.toast, { backgroundColor: bgColor, opacity }]}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.message}>{message}</Text>
        </Animated.View>
    )
}

const styles = StyleSheet.create({
    toast: { 
        position: 'absolute', 
        top: 80, 
        right: 20,
        width: 'auto',
        minWidth: 200,
        maxWidth: 400,
        flexDirection: 'row', 
        alignItems: 'center', 
        padding: 12, 
        borderRadius: 12, 
        gap: 8, 
        zIndex: 9999 
    },icon: { color: '#fff', fontWeight: '700', fontSize: 16 },
    message: { color: '#fff', fontSize: 14, fontWeight: '500', flex: 1 },
})