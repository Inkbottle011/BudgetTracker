import { createElement } from 'react'
import { View, TextInput, StyleSheet, Platform } from 'react-native'
import { parseDate, todayString } from '../money/entry'
import { useTheme, useStyles, Palette } from '../theme/theme'
import { Chip } from './ui'

interface Props {
    value: string
    onChange: (date: string) => void
    hasError?: boolean
    onSubmit?: () => void
}

/**
 * Date input with Today / Yesterday shortcuts.
 * On the web it uses the browser's calendar picker; on phones you can type a date
 * any common way (10/5, 10/5/2026, Oct 5) and it's tidied to YYYY-MM-DD.
 */
export function DateField({ value, onChange, hasError, onSubmit }: Props) {
    const { c: C, scheme } = useTheme()
    const styles = useStyles(makeStyles)
    const today = todayString()
    const yesterday = todayString(-1)
    const normalized = parseDate(value)

    return (
        <View style={styles.row}>
            {Platform.OS === 'web' ? (
                createElement('input', {
                    type: 'date',
                    value: normalized ?? '',
                    max: '2100-12-31',
                    'aria-label': 'Date',
                    onChange: (e: any) => onChange(e.target.value),
                    onKeyDown: (e: any) => { if (e.key === 'Enter' && onSubmit) onSubmit() },
                    style: {
                        flex: 1, minWidth: 0, fontFamily: 'inherit', fontSize: 15, padding: '9px 12px', borderRadius: 10,
                        border: `1px solid ${hasError ? C.bad : C.line}`, backgroundColor: C.surfaceAlt, color: C.ink,
                        colorScheme: scheme,
                    },
                })
            ) : (
                <TextInput
                    accessibilityLabel="Date"
                    style={[styles.input, hasError && styles.inputError]}
                    placeholder="e.g. 10/5 or 2026-10-05"
                    value={value}
                    onChangeText={onChange}
                    onBlur={() => { if (normalized && normalized !== value) onChange(normalized) }}
                    onSubmitEditing={onSubmit}
                    returnKeyType="done"
                    placeholderTextColor={C.faint}
                />
            )}
            <Chip label="Today" selected={normalized === today} onPress={() => onChange(today)} />
            <Chip label="Yesterday" selected={normalized === yesterday} onPress={() => onChange(yesterday)} />
        </View>
    )
}

const makeStyles = (C: Palette) => StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    input: {
        flex: 1, minWidth: 140, backgroundColor: C.surfaceAlt, borderRadius: 10, borderWidth: 1, borderColor: C.line,
        paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: C.ink,
    },
    inputError: { borderColor: C.bad },
})
