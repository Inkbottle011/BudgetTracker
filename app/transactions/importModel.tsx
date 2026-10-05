import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, ActivityIndicator } from 'react-native'
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
            setError("Couldn't open that file.")
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
        upload: 'Import CSV', map: 'Match Columns', checking: 'Checking...', review: 'Review Import', importing: 'Importing...', done: 'Import Finished',
    }

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
        <View style={styles.overlay}>
        <View style={styles.modal}>
        <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>{title[step]}</Text>
        <TouchableOpacity onPress={handleClose}>
        <Text style={styles.closeBtn}>✕</Text>
        </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalBody}>

        {step === 'upload' && (
            <View style={styles.centered}>
            <Text style={styles.stepDesc}>Select a CSV file from your bank to import transactions.</Text>
            <Text style={styles.hint}>Most banks let you export transactions as CSV from their website or app. Importing the same file again won't create duplicates.</Text>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <TouchableOpacity style={styles.uploadBtn} onPress={handlePickFile}>
            <Text style={styles.uploadBtnText}>📂 Choose CSV File</Text>
            </TouchableOpacity>
            </View>
        )}

        {step === 'map' && (
            <View>
            <Text style={styles.stepDesc}>{fileName ? `${fileName}: ` : ''}{rows.length} rows. Check what each column means:</Text>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {headers.map(h => (
                <View key={h} style={styles.mapRow}>
                <Text style={styles.mapCol}>{h} <Text style={styles.mapSample}>e.g. {String(rows[0]?.[h] ?? '').slice(0, 40) || '(empty)'}</Text></Text>
                <View style={styles.mapOptions}>
                {FIELD_OPTIONS.map(opt => (
                    <TouchableOpacity
                    key={opt.value}
                    style={[styles.mapChip, mapping[h] === opt.value && styles.mapChipActive]}
                    onPress={() => { setMapping(prev => ({ ...prev, [h]: opt.value })); setError('') }}
                    >
                    <Text style={[styles.mapChipText, mapping[h] === opt.value && styles.mapChipTextActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                ))}
                </View>
                </View>
            ))}
            {hasAmount && !hasDebitCredit && (
                <View style={styles.signBox}>
                <Text style={styles.mapCol}>In this file, money you spent shows as:</Text>
                <View style={styles.mapOptions}>
                <TouchableOpacity style={[styles.mapChip, spendingSign === 'negative' && styles.mapChipActive]} onPress={() => setSpendingSign('negative')}>
                <Text style={[styles.mapChipText, spendingSign === 'negative' && styles.mapChipTextActive]}>Negative (-12.50)</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.mapChip, spendingSign === 'positive' && styles.mapChipActive]} onPress={() => setSpendingSign('positive')}>
                <Text style={[styles.mapChipText, spendingSign === 'positive' && styles.mapChipTextActive]}>Positive (12.50)</Text>
                </TouchableOpacity>
                </View>
                <Text style={styles.signHint}>Bank accounts usually show spending as negative. Some credit cards show it as positive.</Text>
                </View>
            )}
            </View>
        )}

        {(step === 'checking' || step === 'importing') && (
            <View style={styles.centered}>
            <ActivityIndicator size="large" color="#2980b9" />
            <Text style={[styles.stepDesc, { marginTop: 12 }]}>
            {step === 'checking' ? 'Checking for transactions you already have...' : `Importing ${prepared?.ready.length ?? 0} transactions...`}
            </Text>
            </View>
        )}

        {step === 'review' && prepared && (
            <View>
            <View style={styles.statsRow}>
            <Stat label="Ready to import" value={prepared.ready.length} color="#27ae60" />
            <Stat label="Already imported" value={prepared.duplicates} color="#7f8c8d" />
            <Stat label="Left out" value={prepared.problems.length} color={prepared.problems.length ? '#e74c3c' : '#7f8c8d'} />
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
                {prepared.ready.slice(0, 8).map((r, i) => (
                    <View key={i} style={styles.reviewRow}>
                    <Text style={styles.reviewDate}>{r.transaction.date}</Text>
                    <View style={{ flex: 1 }}>
                    <Text style={styles.reviewDesc} numberOfLines={1}>{r.transaction.name || '—'}</Text>
                    <Text style={styles.reviewMeta} numberOfLines={1}>{[r.transaction.type, r.transaction.category_label].filter(Boolean).join(' · ')}</Text>
                    </View>
                    <Text style={[styles.reviewAmount, { color: r.transaction.type === 'expense' ? '#e74c3c' : '#27ae60' }]}>
                    {r.transaction.type === 'expense' ? '-' : '+'}${r.transaction.amount.toFixed(2)}
                    </Text>
                    </View>
                ))}
                {prepared.ready.length > 8 ? <Text style={styles.hint}>...and {prepared.ready.length - 8} more</Text> : null}
                </>
            )}

            {prepared.problems.length > 0 && (
                <>
                <Text style={[styles.sectionLabel, { color: '#e74c3c' }]}>These rows will be left out</Text>
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
            {result.imported > 0 && <Text style={styles.doneIcon}>✓</Text>}
            <Text style={styles.doneText}>Imported {result.imported} transaction{result.imported === 1 ? '' : 's'}</Text>
            {prepared && prepared.duplicates > 0 && (
                <Text style={styles.hint}>Skipped {prepared.duplicates} you already had.</Text>
            )}
            {result.failed.length > 0 && (
                <View style={{ alignSelf: 'stretch', marginTop: 8 }}>
                <Text style={[styles.sectionLabel, { color: '#e74c3c' }]}>{result.failed.length} couldn't be saved</Text>
                {result.failed.slice(0, 10).map((f, i) => (
                    <Text key={i} style={styles.problemRow}>Row {f.row} ({f.description}): {f.reason}</Text>
                ))}
                </View>
            )}
            </View>
        )}
        </ScrollView>

        <View style={styles.modalFooter}>
        {step === 'map' && (
            <>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => { setStep('upload'); setError('') }}>
            <Text style={styles.secondaryBtnText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleCheck}>
            <Text style={styles.primaryBtnText}>Preview →</Text>
            </TouchableOpacity>
            </>
        )}
        {step === 'review' && prepared && (
            <>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep('map')}>
            <Text style={styles.secondaryBtnText}>Back</Text>
            </TouchableOpacity>
            {prepared.ready.length > 0 && (
                <TouchableOpacity style={styles.primaryBtn} onPress={handleImport}>
                <Text style={styles.primaryBtnText}>Import {prepared.ready.length} Transaction{prepared.ready.length === 1 ? '' : 's'}</Text>
                </TouchableOpacity>
            )}
            </>
        )}
        {step === 'done' && (
            <TouchableOpacity style={styles.primaryBtn} onPress={handleClose}>
            <Text style={styles.primaryBtnText}>Done</Text>
            </TouchableOpacity>
        )}
        </View>
        </View>
        </View>
        </Modal>
    )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <View style={styles.stat}>
        <Text style={[styles.statValue, { color }]}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
        </View>
    )
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
    modal: { backgroundColor: '#fff', borderRadius: 16, width: '90%', maxWidth: 600, maxHeight: '85%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 0.5, borderColor: '#e0e0e0' },
    modalTitle: { fontSize: 18, fontWeight: '700', color: '#2c3e50' },
    closeBtn: { fontSize: 18, color: '#aaa', padding: 4 },
    modalBody: { padding: 16, maxHeight: 460 },
    modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, padding: 16, borderTopWidth: 0.5, borderColor: '#e0e0e0' },
    centered: { alignItems: 'center', paddingVertical: 24 },
    stepDesc: { fontSize: 14, color: '#555', marginBottom: 12, textAlign: 'center' },
    hint: { fontSize: 12, color: '#aaa', marginBottom: 16, textAlign: 'center' },
    note: { fontSize: 12, color: '#7f8c8d', marginBottom: 8 },
    errorText: { color: '#e74c3c', fontSize: 13, marginBottom: 12, textAlign: 'center' },
    uploadBtn: { backgroundColor: '#2980b9', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 14, marginTop: 8 },
    uploadBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    mapRow: { marginBottom: 12, borderBottomWidth: 0.5, borderColor: '#f0f0f0', paddingBottom: 12 },
    mapCol: { fontSize: 13, fontWeight: '600', color: '#2c3e50', marginBottom: 6 },
    mapSample: { fontSize: 12, fontWeight: '400', color: '#999' },
    mapOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    mapChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#f8f9fa' },
    mapChipActive: { backgroundColor: '#2980b9', borderColor: '#2980b9' },
    mapChipText: { fontSize: 12, color: '#555' },
    mapChipTextActive: { color: '#fff' },
    signBox: { backgroundColor: '#f8f9fa', borderRadius: 8, padding: 12, marginTop: 4 },
    signHint: { fontSize: 11, color: '#999', marginTop: 6 },
    statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    stat: { flex: 1, backgroundColor: '#f8f9fa', borderRadius: 8, padding: 10, alignItems: 'center' },
    statValue: { fontSize: 20, fontWeight: '700' },
    statLabel: { fontSize: 11, color: '#888', marginTop: 2, textAlign: 'center' },
    sectionLabel: { fontSize: 12, fontWeight: '700', color: '#7f8c8d', marginTop: 12, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
    reviewRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 0.5, borderColor: '#f0f0f0' },
    reviewDate: { width: 84, fontSize: 12, color: '#888' },
    reviewDesc: { fontSize: 12, color: '#2c3e50' },
    reviewMeta: { fontSize: 11, color: '#999', marginTop: 1 },
    reviewAmount: { width: 80, fontSize: 12, fontWeight: '600', textAlign: 'right' },
    problemRow: { fontSize: 12, color: '#922b21', paddingVertical: 3 },
    primaryBtn: { backgroundColor: '#2980b9', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
    primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
    secondaryBtn: { borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: '#ddd' },
    secondaryBtnText: { color: '#555', fontSize: 14 },
    doneIcon: { fontSize: 48, color: '#27ae60', marginBottom: 12 },
    doneText: { fontSize: 16, fontWeight: '600', color: '#27ae60', textAlign: 'center', marginBottom: 6 },
})
