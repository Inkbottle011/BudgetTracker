import { createElement } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import { parseDate, todayString } from '../lib/entry'

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
    const today = todayString()
    const yesterday = todayString(-1)
    const normalized = parseDate(value)

    return (
        <View>
        <View style={styles.row}>
        {Platform.OS === 'web' ? (
            createElement('input', {
                type: 'date',
                value: normalized ?? '',
                max: '2100-12-31',
                onChange: (e: any) => onChange(e.target.value),
                onKeyDown: (e: any) => { if (e.key === 'Enter' && onSubmit) onSubmit() },
                style: {
                    flex: 1, minWidth: 0, fontFamily: 'inherit', fontSize: 13, padding: 9, borderRadius: 8,
                    border: `1px solid ${hasError ? '#e74c3c' : '#e8e8e8'}`, backgroundColor: '#f8f9fa', color: '#1a1a1a',
                },
            })
        ) : (
            <TextInput
            style={[styles.input, hasError && styles.inputError]}
            placeholder="e.g. 10/5 or 2026-10-05"
            value={value}
            onChangeText={onChange}
            onBlur={() => { if (normalized && normalized !== value) onChange(normalized) }}
            onSubmitEditing={onSubmit}
            returnKeyType="done"
            placeholderTextColor="#aaa"
            />
        )}
        <TouchableOpacity style={[styles.chip, normalized === today && styles.chipActive]} onPress={() => onChange(today)}>
        <Text style={[styles.chipText, normalized === today && styles.chipTextActive]}>Today</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.chip, normalized === yesterday && styles.chipActive]} onPress={() => onChange(yesterday)}>
        <Text style={[styles.chipText, normalized === yesterday && styles.chipTextActive]}>Yesterday</Text>
        </TouchableOpacity>
        </View>
        </View>
    )
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    input: { flex: 1, backgroundColor: '#f8f9fa', borderRadius: 8, padding: 10, fontSize: 13, borderWidth: 1, borderColor: '#e8e8e8', color: '#1a1a1a' },
    inputError: { borderColor: '#e74c3c' },
    chip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#f8f9fa' },
    chipActive: { backgroundColor: '#2c3e50', borderColor: '#2c3e50' },
    chipText: { fontSize: 12, color: '#555' },
    chipTextActive: { color: '#fff' },
})
