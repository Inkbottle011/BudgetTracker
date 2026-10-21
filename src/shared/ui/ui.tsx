// Shared building blocks so every screen looks and behaves the same. Colors come from lib/theme.
import { ReactNode, RefObject } from 'react'
import {
    View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, StyleSheet,
    TextInputProps, ViewStyle, StyleProp, useWindowDimensions,
} from 'react-native'
import { useStyles, useTheme, typeColors } from '../theme/theme'

/** True on screens wide enough for side-by-side layouts. */
export function useIsWide(breakpoint = 900) {
    return useWindowDimensions().width >= breakpoint
}

/** A scrolling page with comfortable margins and a readable maximum width. */
export function Page({ children, maxWidth = 1180 }: { children: ReactNode; maxWidth?: number }) {
    const wide = useIsWide()
    const { backdrop } = useTheme()
    const s = useStyles(c => ({
        page: { flex: 1, backgroundColor: c.page },
        content: { padding: 28, alignItems: 'center' as const },
        narrow: { padding: 16 },
        inner: { width: '100%' as const },
    }))
    return (
        <ScrollView style={[s.page, { backgroundColor: backdrop }]} contentContainerStyle={[s.content, !wide && s.narrow]} keyboardShouldPersistTaps="handled">
            <View style={[s.inner, { maxWidth }]}>{children}</View>
        </ScrollView>
    )
}

/** A page title with optional actions on the right. */
export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
    const s = useStyles(c => ({
        row: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, flexWrap: 'wrap' as const, gap: 12, marginBottom: 16 },
        title: { fontSize: 26, fontWeight: '700' as const, color: c.ink },
        subtitle: { fontSize: 14, color: c.muted, marginTop: 4, lineHeight: 20 },
        actions: { flexDirection: 'row' as const, gap: 8, flexWrap: 'wrap' as const },
    }))
    return (
        <View style={s.row}>
            <View style={{ flexShrink: 1 }}>
                <Text style={s.title} accessibilityRole="header">{title}</Text>
                {subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
            </View>
            {actions && <View style={s.actions}>{actions}</View>}
        </View>
    )
}

/** A white (or dark) block with an optional title and action. */
export function Section({ title, action, children, style }: { title?: string; action?: ReactNode; children: ReactNode; style?: StyleProp<ViewStyle> }) {
    const s = useStyles(c => ({
        box: { backgroundColor: c.surface, borderRadius: 14, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: c.line },
        head: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, gap: 12, marginBottom: 10 },
        title: { fontSize: 18, fontWeight: '700' as const, color: c.ink, flexShrink: 1 },
    }))
    return (
        <View style={[s.box, style]}>
            {(title || action) && (
                <View style={s.head}>
                    {title ? <Text style={s.title}>{title}</Text> : <View />}
                    {action}
                </View>
            )}
            {children}
        </View>
    )
}

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

export function Button({ label, onPress, variant = 'primary', disabled, loading, small, accessibilityLabel, style }: {
    label: string
    onPress: () => void
    variant?: Variant
    disabled?: boolean
    loading?: boolean
    small?: boolean
    accessibilityLabel?: string
    style?: StyleProp<ViewStyle>
}) {
    const { c } = useTheme()
    const s = useStyles(c => ({
        base: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center' as const, justifyContent: 'center' as const, minHeight: 40 },
        small: { paddingHorizontal: 12, paddingVertical: 6, minHeight: 32 },
        primary: { backgroundColor: c.primary },
        secondary: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.line },
        danger: { backgroundColor: c.badSoft },
        ghost: { paddingHorizontal: 4, minHeight: 0, paddingVertical: 4 },
        disabled: { opacity: 0.5 },
        text: { fontSize: 14, fontWeight: '600' as const },
        smallText: { fontSize: 13 },
    }))
    const color = variant === 'primary' ? c.onPrimary : variant === 'danger' ? c.bad : variant === 'ghost' ? c.primary : c.ink
    return (
        <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel ?? label}
            accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
            onPress={onPress}
            disabled={disabled || loading}
            style={[s.base, small && s.small, s[variant], (disabled || loading) && s.disabled, style]}
        >
            {loading ? <ActivityIndicator size="small" color={color} /> : <Text style={[s.text, small && s.smallText, { color }]}>{label}</Text>}
        </TouchableOpacity>
    )
}

/** A labelled text box, with an optional hint or problem underneath. */
export function Field({ label, error, hint, style, inputRef, ...input }: TextInputProps & {
    label: string
    error?: string | null
    hint?: string
    /** To move the cursor into this field from code */
    inputRef?: RefObject<TextInput | null>
}) {
    const { c } = useTheme()
    const s = useStyles(c => ({
        wrap: { marginBottom: 14 },
        label: { fontSize: 13, fontWeight: '600' as const, color: c.text, marginBottom: 6 },
        input: { backgroundColor: c.surfaceAlt, borderRadius: 10, borderWidth: 1, borderColor: c.line, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: c.ink },
        inputError: { borderColor: c.bad },
        error: { fontSize: 12, color: c.bad, marginTop: 5 },
        hint: { fontSize: 12, color: c.muted, marginTop: 5 },
    }))
    return (
        <View style={s.wrap}>
            <Text style={s.label}>{label}</Text>
            <TextInput ref={inputRef} accessibilityLabel={label} placeholderTextColor={c.faint} style={[s.input, !!error && s.inputError, style]} {...input} />
            {error ? <Text style={s.error}>{error}</Text> : hint ? <Text style={s.hint}>{hint}</Text> : null}
        </View>
    )
}

/** A rounded choice button, e.g. a category. */
export function Chip({ label, selected, onPress, tone }: { label: string; selected?: boolean; onPress: () => void; tone?: string }) {
    const { c } = useTheme()
    const s = useStyles(c => ({
        chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface },
        text: { fontSize: 13, color: c.text, fontWeight: '500' as const },
    }))
    const colors = tone ? typeColors(tone, c) : { fg: c.onPrimary, bg: c.primary }
    return (
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!selected }} onPress={onPress}
            style={[s.chip, selected && { backgroundColor: tone ? colors.bg : c.primary, borderColor: tone ? colors.fg : c.primary }]}>
            <Text style={[s.text, selected && { color: tone ? colors.fg : c.onPrimary, fontWeight: '600' }]}>{label}</Text>
        </TouchableOpacity>
    )
}

/** Two to four options side by side, one selected. */
export function Segmented<T extends string>({ value, onChange, options, style }: {
    value: T
    onChange: (v: T) => void
    options: { value: T; label: string }[]
    style?: StyleProp<ViewStyle>
}) {
    const s = useStyles(c => ({
        wrap: { flexDirection: 'row' as const, backgroundColor: c.track, borderRadius: 10, padding: 3, alignSelf: 'flex-start' as const },
        btn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
        on: { backgroundColor: c.surface, shadowColor: c.shadow, shadowOpacity: 0.08, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
        text: { fontSize: 13, color: c.muted, fontWeight: '600' as const },
        textOn: { color: c.ink },
    }))
    return (
        <View style={[s.wrap, style]}>
            {options.map(o => (
                <TouchableOpacity key={o.value} onPress={() => onChange(o.value)} style={[s.btn, value === o.value && s.on]}
                    accessibilityRole="button" accessibilityState={{ selected: value === o.value }}>
                    <Text style={[s.text, value === o.value && s.textOn]}>{o.label}</Text>
                </TouchableOpacity>
            ))}
        </View>
    )
}

/** A small colored label for a transaction type. */
export function TypeBadge({ type }: { type: string }) {
    const { c } = useTheme()
    const { fg, bg } = typeColors(type, c)
    const label = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()
    return (
        <View style={[styles.badge, { backgroundColor: bg }]}>
            <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
        </View>
    )
}

/** What to show when there's nothing yet, and what to do about it. */
export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
    const s = useStyles(c => ({
        wrap: { alignItems: 'center' as const, paddingVertical: 28, gap: 6 },
        title: { fontSize: 16, fontWeight: '600' as const, color: c.ink, textAlign: 'center' as const },
        body: { fontSize: 14, color: c.muted, textAlign: 'center' as const, lineHeight: 20, maxWidth: 360 },
    }))
    return (
        <View style={s.wrap}>
            <Text style={s.title}>{title}</Text>
            {body && <Text style={s.body}>{body}</Text>}
            {action && <View style={{ marginTop: 8 }}>{action}</View>}
        </View>
    )
}

const styles = StyleSheet.create({
    badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, alignSelf: 'flex-start' },
    badgeText: { fontSize: 12, fontWeight: '600' },
})
