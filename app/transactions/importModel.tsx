import { useState } from 'react'
import { View, Text, StyleSheet, Modal, ScrollView, ActivityIndicator } from 'react-native'
import { Button, Chip, useIsWide } from '../../components/ui'
import { useTheme, useStyles, Palette, tabular } from '../../lib/theme'
import { todayString } from '../../lib/entry'
import { displayDate, amountText } from './listLogic'
import * as DocumentPicker from 'expo-document-picker'
import Papa from 'papaparse'
import { supabase } from '../../lib/supabase'
import { prepareImport, ImportField, PreparedImport, guessFields, SpendingSign } from './importLogic'

interface Props {
    visible: boolean
    onClose: () => void
    onImported: () => void
}

const FIELD_OPTIONS: { value: ImportField; label: string }[] = [
    { value: 'date', label: 'Date' },
    { value: 'amount', label: 'Amount' },
    { value: 'debit', label: 'Money out' },
    { value: 'credit', label: 'Money in' },
    { value: 'description', label: 'Description' },
    { value: 'type', label: 'Type' },
    { value: 'category', label: 'Category' },
    { value: 'skip', label: 'Skip' },
]

type Step = 'upload' | 'map' | 'checking' | 'review' | 'importing' | 'done'

interface ImportResult {
    imported: number
    failed: { row: number; description: string; reason: string }[]
}

export function ImportModal({ visible, onClose, onImported }: Props) {
    const [step, setStep] = useState<Step>('upload')
    const [fileName, setFileName] = useState('')
    const [headers, setHeaders] = useState<string[]>([])
    const [rows, setRows] = useState<Record<string, string>[]>([])
    const [mapping, setMapping] = useState<Record<string, ImportField>>({})
    const [spendingSign, setSpendingSign] = useState<SpendingSign>('negative')
    const [prepared, setPrepared] = useState<PreparedImport | null>(null)
    const [result, setResult] = useState<ImportResult | null>(null)
    const [error, setError] = useState('')
    const { c: C } = useTheme()
    const styles = useStyles(makeStyles)
    const wide = useIsWide()
    const today = todayString()

    async function handlePickFile() {
        try {
            const picked = await DocumentPicker.getDocumentAsync({
                type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', 'text/plain'],
                copyToCacheDirectory: true,
            })
            if (picked.canceled) return
            const file = picked.assets[0]
            const text = await (await fetch(file.uri)).text()
            const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ''), {
                header: true,
                skipEmptyLines: 'greedy',
                transformHeader: h => h.trim(),
            })
            const data = parsed.data.filter(r => Object.values(r).some(v => String(v ?? '').trim() !== ''))
            if (data.length === 0) {
                setError("That file doesn't have any rows we could read. Make sure it's a CSV export from your bank.")
                return
            }
            const hdrs = (parsed.meta.fields ?? Object.keys(data[0])).filter(h => h !== '')
            const autoMap = guessFields(hdrs)
            setFileName(file.name)
            setHeaders(hdrs)
            setRows(data)
            setMapping(autoMap)
            setError('')
            setStep('map')
        } catch {
            setError("Couldn't open that file. Export it from your bank again as a CSV and try once more.")
        }
    }

    const fields = Object.values(mapping)
    const hasAmount = fields.includes('amount')
    const hasDebitCredit = fields.includes('debit') || fields.includes('credit')

    async function handleCheck() {
        if (!fields.includes('date')) { setError('Pick which column is the Date.'); return }
        if (!hasAmount && !hasDebitCredit) { setError('Pick an Amount column, or Money out / Money in columns.'); return }
        if (hasAmount && hasDebitCredit) { setError('Use either one Amount column or Money out / Money in columns, not both.'); return }
        if (fields.filter(f => f === 'amount').length > 1) { setError('Only one column can be the Amount.'); return }
        setError('')
        setStep('checking')
        try {
            const p = await prepareImport(rows, mapping, spendingSign)
            setPrepared(p)
            setStep('review')
        } catch (e: any) {
            setError(`Couldn't check against your transactions: ${e?.message ?? 'unknown error'}`)
            setStep('map')
        }
    }

    async function handleImport() {
        if (!prepared) return
        setStep('importing')
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { setError('You were signed out. Sign in and try again.'); setStep('review'); return }

        const toInsert = prepared.ready.map(r => ({ ...r.transaction, user_id: session.user.id }))
        const failed: ImportResult['failed'] = []
        let imported = 0
        const CHUNK = 50
        for (let i = 0; i < toInsert.length; i += CHUNK) {
            const chunk = toInsert.slice(i, i + CHUNK)
            const { error } = await supabase.from('transactions').insert(chunk)
            if (!error) { imported += chunk.length; continue }
            // Something in this batch was rejected: try each row on its own to find which
            for (let j = 0; j < chunk.length; j++) {
                const { error: rowError } = await supabase.from('transactions').insert(chunk[j])
                if (rowError) {
                    const src = prepared.ready[i + j]
                    failed.push({ row: src.row, description: src.transaction.name || '—', reason: rowError.message })
                } else {
                    imported++
                }
            }
        }
        setResult({ imported, failed })
        setStep('done')
        if (imported > 0) onImported()
    }

    function handleClose() {
        setStep('upload')
        setFileName('')
        setHeaders([])
        setRows([])
        setMapping({})
        setSpendingSign('negative')
        setPrepared(null)
        setResult(null)
        setError('')
        onClose()
    }

    const title: Record<Step, string> = {
        upload: 'Import CSV', map: 'Match columns', checking: 'Checking...', review: 'Review import', importing: 'Importing...', done: 'Import finished',
    }

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
            <View style={[styles.overlay, !wide && styles.overlayPhone]}>
                <View style={[styles.modal, !wide && styles.modalPhone]}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle} accessibilityRole="header">{title[step]}</Text>
                        <Button variant="ghost" label="Close" onPress={handleClose} />
                    </View>

                    <ScrollView style={styles.modalBody} contentContainerStyle={{ padding: 20 }}>
                        {step === 'upload' && (
                            <View style={styles.centered}>
                                <Text style={styles.stepDesc}>Pick a CSV file from your bank to bring in its transactions.</Text>
                                <Text style={styles.hint}>Most banks let you export transactions as CSV from their website or app. Importing the same file again won't create duplicates.</Text>
                                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                                <Button label="Choose a CSV file" onPress={handlePickFile} />
                            </View>
                        )}

                        {step === 'map' && (
                            <View>
                                <Text style={styles.stepDescLeft}>{fileName ? `${fileName}: ` : ''}{rows.length} rows. Check what each column means:</Text>
                                {error ? <Text style={styles.errorTextLeft}>{error}</Text> : null}
                                {headers.map(h => (
                                    <View key={h} style={styles.mapRow}>
                                        <Text style={styles.mapCol}>{h} <Text style={styles.mapSample}>e.g. {String(rows[0]?.[h] ?? '').slice(0, 40) || '(empty)'}</Text></Text>
                                        <View style={styles.chips}>
                                            {FIELD_OPTIONS.map(opt => (
                                                <Chip key={opt.value} label={opt.label} selected={mapping[h] === opt.value}
                                                    onPress={() => { setMapping(prev => ({ ...prev, [h]: opt.value })); setError('') }} />
                                            ))}
                                        </View>
                                    </View>
                                ))}
                                {hasAmount && !hasDebitCredit && (
                                    <View style={styles.signBox}>
                                        <Text style={styles.mapCol}>In this file, money you spent shows as:</Text>
                                        <View style={styles.chips}>
                                            <Chip label="Negative (-12.50)" selected={spendingSign === 'negative'} onPress={() => setSpendingSign('negative')} />
                                            <Chip label="Positive (12.50)" selected={spendingSign === 'positive'} onPress={() => setSpendingSign('positive')} />
                                        </View>
                                        <Text style={styles.signHint}>Bank accounts usually show spending as negative. Some credit cards show it as positive.</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {(step === 'checking' || step === 'importing') && (
                            <View style={styles.centered}>
                                <ActivityIndicator size="large" color={C.primary} />
                                <Text style={[styles.stepDesc, { marginTop: 12 }]}>
                                    {step === 'checking' ? 'Checking for transactions you already have...' : `Importing ${prepared?.ready.length ?? 0} transactions...`}
                                </Text>
                            </View>
                        )}

                        {step === 'review' && prepared && (
                            <View>
                                <View style={styles.statsRow}>
                                    <Stat label="Ready to import" value={prepared.ready.length} color={C.good} styles={styles} />
                                    <Stat label="Already imported" value={prepared.duplicates} color={C.muted} styles={styles} />
                                    <Stat label="Left out" value={prepared.problems.length} color={prepared.problems.length ? C.bad : C.muted} styles={styles} />
                                </View>
                                {prepared.dateOrder === 'DMY' && (
                                    <Text style={styles.note}>Dates in this file are day-first (like 25/12/2026).</Text>
                                )}
                                {prepared.categorized > 0 && (
                                    <Text style={styles.note}>{prepared.categorized} transaction{prepared.categorized > 1 ? 's were' : ' was'} given a category based on how you categorized the same place before.</Text>
                                )}

                                {prepared.ready.length > 0 && (
                                    <>
                                        <Text style={styles.sectionLabel}>Preview</Text>
                                        {prepared.ready.slice(0, 8).map((r, i) => {
                                            const shown = amountText(r.transaction)
                                            return (
                                                <View key={i} style={styles.reviewRow}>
                                                    <Text style={[styles.reviewDate, tabular]}>{displayDate(r.transaction.date, today)}</Text>
                                                    <View style={{ flex: 1, minWidth: 0 }}>
                                                        <Text style={styles.reviewDesc} numberOfLines={2}>{r.transaction.name || 'No description'}</Text>
                                                        <Text style={styles.reviewMeta} numberOfLines={1}>{[r.transaction.type, r.transaction.category_label].filter(Boolean).join(' · ')}</Text>
                                                    </View>
                                                    <Text style={[styles.reviewAmount, tabular, { color: shown.direction === 'in' ? C.good : shown.direction === 'move' ? C.move : C.ink }]}>
                                                        {shown.text}
                                                    </Text>
                                                </View>
                                            )
                                        })}
                                        {prepared.ready.length > 8 ? <Text style={styles.hint}>...and {prepared.ready.length - 8} more</Text> : null}
                                    </>
                                )}

                                {prepared.problems.length > 0 && (
                                    <>
                                        <Text style={[styles.sectionLabel, { color: C.bad }]}>These rows will be left out</Text>
                                        {prepared.problems.slice(0, 10).map((p, i) => (
                                            <Text key={i} style={styles.problemRow}>Row {p.row}: {p.reason}</Text>
                                        ))}
                                        {prepared.problems.length > 10 ? <Text style={styles.hint}>...and {prepared.problems.length - 10} more</Text> : null}
                                    </>
                                )}

                                {prepared.ready.length === 0 && (
                                    <Text style={[styles.stepDesc, { marginTop: 12 }]}>Nothing new to import.</Text>
                                )}
                                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                            </View>
                        )}

                        {step === 'done' && result && (
                            <View style={styles.centered}>
                                <Text style={[styles.doneText, { color: result.imported > 0 ? C.good : C.ink }]}>
                                    Imported {result.imported} transaction{result.imported === 1 ? '' : 's'}
                                </Text>
                                {prepared && prepared.duplicates > 0 && (
                                    <Text style={styles.hint}>Skipped {prepared.duplicates} you already had.</Text>
                                )}
                                {result.failed.length > 0 && (
                                    <View style={{ alignSelf: 'stretch', marginTop: 8 }}>
                                        <Text style={[styles.sectionLabel, { color: C.bad }]}>{result.failed.length} couldn't be saved</Text>
                                        {result.failed.slice(0, 10).map((f, i) => (
                                            <Text key={i} style={styles.problemRow}>Row {f.row} ({f.description}): {f.reason}</Text>
                                        ))}
                                    </View>
                                )}
                            </View>
                        )}
                    </ScrollView>

                    {(step === 'map' || (step === 'review' && prepared) || step === 'done') && (
                        <View style={styles.modalFooter}>
                            {step === 'map' && (
                                <>
                                    <Button variant="secondary" label="Back" onPress={() => { setStep('upload'); setError('') }} />
                                    <Button label="Preview" onPress={handleCheck} />
                                </>
                            )}
                            {step === 'review' && prepared && (
                                <>
                                    <Button variant="secondary" label="Back" onPress={() => setStep('map')} />
                                    {prepared.ready.length > 0 && (
                                        <Button label={`Import ${prepared.ready.length} transaction${prepared.ready.length === 1 ? '' : 's'}`} onPress={handleImport} />
                                    )}
                                </>
                            )}
                            {step === 'done' && <Button label="Done" onPress={handleClose} />}
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    )
}

function Stat({ label, value, color, styles }: { label: string; value: number; color: string; styles: ReturnType<typeof makeStyles> }) {
    return (
        <View style={styles.stat}>
            <Text style={[styles.statValue, tabular, { color }]}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    )
}

const makeStyles = (C: Palette) => StyleSheet.create({
    // The dimmed backdrop: the theme's shadow color, see-through
    overlay: { flex: 1, backgroundColor: C.shadow + '66', justifyContent: 'center', alignItems: 'center', padding: 16 },
    overlayPhone: { padding: 0, justifyContent: 'flex-end' },
    modal: { backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.line, width: '100%', maxWidth: 600, maxHeight: '88%' },
    modalPhone: { maxHeight: '94%', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderColor: C.line },
    modalTitle: { fontSize: 18, fontWeight: '700', color: C.ink },
    modalBody: { flexGrow: 0 },
    modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderColor: C.line },
    centered: { alignItems: 'center', paddingVertical: 16 },
    stepDesc: { fontSize: 15, color: C.text, marginBottom: 10, textAlign: 'center', lineHeight: 21 },
    stepDescLeft: { fontSize: 14, color: C.text, marginBottom: 12, lineHeight: 20 },
    hint: { fontSize: 13, color: C.muted, marginBottom: 16, textAlign: 'center', lineHeight: 18 },
    note: { fontSize: 13, color: C.muted, marginBottom: 8, lineHeight: 18 },
    errorText: { color: C.bad, fontSize: 13, marginBottom: 12, textAlign: 'center' },
    errorTextLeft: { color: C.bad, fontSize: 13, marginBottom: 12 },
    mapRow: { marginBottom: 12, borderBottomWidth: 1, borderColor: C.line, paddingBottom: 12 },
    mapCol: { fontSize: 14, fontWeight: '600', color: C.ink, marginBottom: 8 },
    mapSample: { fontSize: 12, fontWeight: '400', color: C.muted },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    signBox: { backgroundColor: C.surfaceAlt, borderRadius: 10, padding: 12, marginTop: 4 },
    signHint: { fontSize: 12, color: C.muted, marginTop: 8 },
    statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    stat: { flex: 1, backgroundColor: C.surfaceAlt, borderRadius: 10, padding: 10, alignItems: 'center' },
    statValue: { fontSize: 20, fontWeight: '700' },
    statLabel: { fontSize: 12, color: C.muted, marginTop: 2, textAlign: 'center' },
    sectionLabel: { fontSize: 14, fontWeight: '700', color: C.ink, marginTop: 14, marginBottom: 4 },
    reviewRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderColor: C.line },
    reviewDate: { width: 56, fontSize: 12, color: C.muted },
    reviewDesc: { fontSize: 14, color: C.ink },
    reviewMeta: { fontSize: 12, color: C.muted, marginTop: 1 },
    reviewAmount: { fontSize: 14, fontWeight: '600', textAlign: 'right' },
    problemRow: { fontSize: 13, color: C.bad, paddingVertical: 3 },
    doneText: { fontSize: 17, fontWeight: '600', textAlign: 'center', marginBottom: 6 },
})
