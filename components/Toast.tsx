import { useEffect, useRef } from 'react'
import { Animated, Text, StyleSheet, useWindowDimensions } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme, useStyles, Palette } from '../lib/theme'

export type ToastType = 'success' | 'error' | 'info'

interface ToastProps {
    message: string
    type?: ToastType
    visible: boolean
    onHide: () => void
    duration?: number
}

/** A short message that slides in under the header and goes away on its own. Errors stay a little longer. */
export function Toast({ message, type = 'success', visible, onHide, duration }: ToastProps) {
    const { c: C } = useTheme()
    const styles = useStyles(makeStyles)
    const { width } = useWindowDimensions()
    const opacity = useRef(new Animated.Value(0)).current
    const shownFor = duration ?? (type === 'error' ? 5000 : 3000)

    useEffect(() => {
        if (visible) {
            opacity.setValue(0)
            const run = Animated.sequence([
                Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
                Animated.delay(shownFor),
                Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
            ])
            run.start(({ finished }) => { if (finished) onHide() })
            return () => run.stop()
        }
    }, [visible, message])

    if (!visible) return null

    const isError = type === 'error'
    const icon = type === 'success' ? 'checkmark-circle' : isError ? 'alert-circle' : 'information-circle'
    const fg = C.page // reads well on both the ink and the bad background, in light and dark
    const narrow = width < 600

    return (
        <Animated.View
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={[styles.toast, narrow ? styles.narrow : styles.wide, { backgroundColor: isError ? C.bad : C.ink, opacity }]}
        >
            <Ionicons name={icon} size={18} color={fg} />
            <Text style={[styles.message, { color: fg }]}>{message}</Text>
        </Animated.View>
    )
}

const makeStyles = (C: Palette) => StyleSheet.create({
    toast: {
        position: 'absolute',
        top: 72,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 12,
        gap: 10,
        zIndex: 9999,
        shadowColor: C.shadow,
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
    },
    narrow: { left: 16, right: 16 },
    wide: { right: 24, minWidth: 240, maxWidth: 420 },
    message: { fontSize: 14, fontWeight: '500', lineHeight: 19, flex: 1 },
})
