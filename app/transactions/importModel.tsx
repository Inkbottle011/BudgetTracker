import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, ActivityIndicator } from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import Papa from 'papaparse'
import { supabase } from '../../lib/supabase'

interface Props {
    visible: boolean
    onClose: () => void
    onImported: () => void
}

const FIELD_OPTIONS = ['date', 'amount', 'description', 'type', 'category', 'skip']

export function ImportModal({ visible, onClose, onImported }: Props) {
    const [step, setStep] = useState<'upload' | 'map' | 'review' | 'importing' | 'done'>('upload')
    const [headers, setHeaders] = useState<string[]>([])
    const [rows, setRows] = useState<any[]>([])
    const [mapping, setMapping] = useState<Record<string, string>>({})
    const [preview, setPreview] = useState<any[]>([])
    const [importCount, setImportCount] = useState(0)
    const [error, setError] = useState('')
    
    async function handlePickFile() {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'text/csv',
                copyToCacheDirectory: true,
            })
            
            if (result.canceled) return
            
            const file = result.assets[0]
            const response = await fetch(file.uri)
            const text = await response.text()
            
            Papa.parse(text, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    if (results.data.length === 0) {
                        setError('No data found in CSV file.')
                        return
                    }
                    const hdrs = Object.keys(results.data[0] as object)
                    setHeaders(hdrs)
                    setRows(results.data as any[])
                    
                    // Auto-guess mapping
                    const autoMap: Record<string, string> = {}
                    hdrs.forEach(h => {
                        const lower = h.toLowerCase()
                        if (lower.includes('date')) autoMap[h] = 'date'
                        else if (lower.includes('amount') || lower.includes('debit') || lower.includes('credit')) autoMap[h] = 'amount'
                        else if (lower.includes('desc') || lower.includes('memo') || lower.includes('narr') || lower.includes('detail')) autoMap[h] = 'description'
                        else if (lower.includes('type') || lower.includes('kind')) autoMap[h] = 'type'
                        else if (lower.includes('cat')) autoMap[h] = 'category'
                        else autoMap[h] = 'skip'
                    })
                    setMapping(autoMap)
                    setError('')
                    setStep('map')
                },
                error: () => setError('Failed to parse CSV file.')
            })
        } catch (e) {
            setError('Failed to open file.')
        }
    }
    
    function buildPreview() {
        return rows.slice(0, 5).map(row => {
            const mapped: any = {}
            Object.entries(mapping).forEach(([col, field]) => {
                if (field !== 'skip') mapped[field] = row[col]
            })
            return mapped
        })
    }
    
    function handleGoToReview() {
        if (!Object.values(mapping).includes('date')) {
            setError('Please map a Date column.')
            return
        }
        if (!Object.values(mapping).includes('amount')) {
            setError('Please map an Amount column.')
            return
        }
        setError('')
        setPreview(buildPreview())
        setStep('review')
    }
    
    async function handleImport() {
        setStep('importing')
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        
        const toInsert = rows.map(row => {
            const mapped: any = {}
            Object.entries(mapping).forEach(([col, field]) => {
                if (field !== 'skip') mapped[field] = row[col]
            })
            
            const amount = Math.abs(parseFloat(mapped.amount?.toString().replace(/[^0-9.-]/g, '') || '0'))
            const isExpense = parseFloat(mapped.amount?.toString().replace(/[^0-9.-]/g, '') || '0') < 0
            
            return {
                user_id: session.user.id,
                date: mapped.date || new Date().toISOString().split('T')[0],
                amount,
                type: mapped.type?.toLowerCase() || (isExpense ? 'expense' : 'income'),
                note: mapped.description || '',
                name: mapped.description || '',
                category_label: mapped.category || '',
                category_id: null,
            }
        }).filter(t => t.amount > 0)
        
        const chunkSize = 50
        for (let i = 0; i < toInsert.length; i += chunkSize) {
            await supabase.from('transactions').insert(toInsert.slice(i, i + chunkSize))
        }
        
        setImportCount(toInsert.length)
        setStep('done')
        onImported()
    }
    
    function handleClose() {
        setStep('upload')
        setHeaders([])
        setRows([])
        setMapping({})
        setPreview([])
        setImportCount(0)
        setError('')
        onClose()
    }
    
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
        <View style={styles.overlay}>
        <View style={styles.modal}>
        {/* Header */}
        <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>
        {step === 'upload' && 'Import CSV'}
        {step === 'map' && 'Map Columns'}
        {step === 'review' && 'Review Import'}
        {step === 'importing' && 'Importing...'}
        {step === 'done' && 'Import Complete'}
        </Text>
        <TouchableOpacity onPress={handleClose}>
        <Text style={styles.closeBtn}>✕</Text>
        </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.modalBody}>
        
        {/* Step 1: Upload */}
        {step === 'upload' && (
            <View style={styles.centered}>
            <Text style={styles.stepDesc}>Select a CSV file from your bank to import transactions.</Text>
            <Text style={styles.hint}>Most banks let you export transactions as CSV from their website or app.</Text>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <TouchableOpacity style={styles.uploadBtn} onPress={handlePickFile}>
            <Text style={styles.uploadBtnText}>📂 Choose CSV File</Text>
            </TouchableOpacity>
            </View>
        )}
        
        {/* Step 2: Map columns */}
        {step === 'map' && (
            <View>
            <Text style={styles.stepDesc}>We found {rows.length} rows. Tell us what each column means:</Text>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {headers.map(h => (
                <View key={h} style={styles.mapRow}>
                <Text style={styles.mapCol}>{h}</Text>
                <View style={styles.mapOptions}>
                {FIELD_OPTIONS.map(opt => (
                    <TouchableOpacity
                    key={opt}
                    style={[styles.mapChip, mapping[h] === opt && styles.mapChipActive]}
                    onPress={() => setMapping(prev => ({ ...prev, [h]: opt }))}
                    >
                    <Text style={[styles.mapChipText, mapping[h] === opt && styles.mapChipTextActive]}>
                    {opt}
                    </Text>
                    </TouchableOpacity>
                ))}
                </View>
                </View>
            ))}
            <View style={styles.previewBox}>
            <Text style={styles.previewTitle}>Sample row:</Text>
            {headers.map(h => (
                <Text key={h} style={styles.previewRow}>
                <Text style={styles.previewKey}>{h}: </Text>
                {String(rows[0]?.[h] ?? '')}
                </Text>
            ))}
            </View>
            </View>
        )}
        
        {/* Step 3: Review */}
        {step === 'review' && (
            <View>
            <Text style={styles.stepDesc}>Importing {rows.length} transactions. Here's a preview:</Text>
            {preview.map((p, i) => (
                <View key={i} style={styles.reviewRow}>
                <Text style={styles.reviewDate}>{p.date}</Text>
                <Text style={styles.reviewDesc} numberOfLines={1}>{p.description || '—'}</Text>
                <Text style={[styles.reviewAmount, { color: '#e74c3c' }]}>${Math.abs(parseFloat(p.amount || 0)).toFixed(2)}</Text>
                </View>
            ))}
            {rows.length > 5 ? <Text style={styles.hint}>...and {rows.length - 5} more</Text> : null}
            </View>
        )}
        
        {/* Importing */}
        {step === 'importing' && (
            <View style={styles.centered}>
            <ActivityIndicator size="large" color="#2980b9" />
            <Text style={styles.stepDesc}>Importing {rows.length} transactions...</Text>
            </View>
        )}
        
        {/* Done */}
        {step === 'done' && (
            <View style={styles.centered}>
            <Text style={styles.doneIcon}>✓</Text>
            <Text style={styles.doneText}>Successfully imported {importCount} transactions!</Text>
            </View>
        )}
        
        </ScrollView>
        
        {/* Footer buttons */}
        <View style={styles.modalFooter}>
        {step === 'map' && (
            <>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep('upload')}>
            <Text style={styles.secondaryBtnText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleGoToReview}>
            <Text style={styles.primaryBtnText}>Preview →</Text>
            </TouchableOpacity>
            </>
        )}
        {step === 'review' && (
            <>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep('map')}>
            <Text style={styles.secondaryBtnText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleImport}>
            <Text style={styles.primaryBtnText}>Import {rows.length} Transactions</Text>
            </TouchableOpacity>
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

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
    modal: { backgroundColor: '#fff', borderRadius: 16, width: '90%', maxWidth: 600, maxHeight: '85%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 0.5, borderColor: '#e0e0e0' },
    modalTitle: { fontSize: 18, fontWeight: '700', color: '#2c3e50' },
    closeBtn: { fontSize: 18, color: '#aaa', padding: 4 },
    modalBody: { padding: 16, maxHeight: 400 },
    modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, padding: 16, borderTopWidth: 0.5, borderColor: '#e0e0e0' },
    centered: { alignItems: 'center', paddingVertical: 24 },
    stepDesc: { fontSize: 14, color: '#555', marginBottom: 12, textAlign: 'center' },
    hint: { fontSize: 12, color: '#aaa', marginBottom: 16, textAlign: 'center' },
    errorText: { color: '#e74c3c', fontSize: 13, marginBottom: 12, textAlign: 'center' },
    uploadBtn: { backgroundColor: '#2980b9', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 14, marginTop: 8 },
    uploadBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    mapRow: { marginBottom: 12, borderBottomWidth: 0.5, borderColor: '#f0f0f0', paddingBottom: 12 },
    mapCol: { fontSize: 13, fontWeight: '600', color: '#2c3e50', marginBottom: 6 },
    mapOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    mapChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#f8f9fa' },
    mapChipActive: { backgroundColor: '#2980b9', borderColor: '#2980b9' },
    mapChipText: { fontSize: 12, color: '#555' },
    mapChipTextActive: { color: '#fff' },
    previewBox: { backgroundColor: '#f8f9fa', borderRadius: 8, padding: 12, marginTop: 12 },
    previewTitle: { fontSize: 12, fontWeight: '600', color: '#888', marginBottom: 6 },
    previewRow: { fontSize: 12, color: '#555', marginBottom: 3 },
    previewKey: { fontWeight: '600', color: '#2c3e50' },
    reviewRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 0.5, borderColor: '#f0f0f0' },
    reviewDate: { width: 90, fontSize: 12, color: '#888' },
    reviewDesc: { flex: 1, fontSize: 12, color: '#2c3e50' },
    reviewAmount: { width: 70, fontSize: 12, fontWeight: '600', textAlign: 'right' },
    primaryBtn: { backgroundColor: '#2980b9', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
    primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
    secondaryBtn: { borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: '#ddd' },
    secondaryBtnText: { color: '#555', fontSize: 14 },
    doneIcon: { fontSize: 48, color: '#27ae60', marginBottom: 12 },
    doneText: { fontSize: 16, fontWeight: '600', color: '#27ae60', textAlign: 'center' },
})