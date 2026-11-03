import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Button } from '../../../shared/ui/ui'
import { useStyles, useTheme, Palette } from '../../../shared/theme/theme'
import { loadProgress, isBrandNew } from '../logic/progress'
import { wasWelcomed, markWelcomed } from '../logic/remember'
import { linkBank, importFile, addOne, go, StepAction, Tab } from '../logic/steps'

const POINTS: { icon: string; text: string }[] = [
    { icon: 'wallet-outline', text: 'See where your money goes, day by day or month by month.' },
    { icon: 'bar-chart-outline', text: 'Plan how much to spend on each thing, and see how you\'re doing.' },
    { icon: 'repeat-outline', text: 'Keep track of rent, bills and subscriptions, added on their dates.' },
]

const CHOICES: { action: StepAction | null; title: string; help: string; icon: string }[] = [
    { action: linkBank, title: 'Link my bank', icon: 'business-outline',
        help: "New transactions come in by themselves every morning. First you'll turn on two-factor sign-in, to keep your account safe." },
    { action: importFile, title: 'Bring in a file from my bank', icon: 'document-text-outline',
        help: "Download a CSV file from your bank's website, then import it here." },
    { action: addOne, title: 'Type them in myself', icon: 'create-outline',
        help: 'Add transactions one at a time.' },
    { action: null, title: "I'll decide later", icon: 'time-outline',
        help: 'Look around first.' },
]

/** Shown once, the first time someone brand new signs in: what the app does, and how to get started. */
export function WelcomeTour({ onGo }: { onGo: (tab: Tab) => void }) {
    const styles = useStyles(makeStyles)
    const { c: C } = useTheme()
    const [show, setShow] = useState(false)
    const [step, setStep] = useState<1 | 2>(1)

    useEffect(() => {
        let live = true
        ;(async () => {
            if (await wasWelcomed()) return
            const p = await loadProgress()
            if (!p || !live) return        // couldn't tell: try again next time
            if (isBrandNew(p)) setShow(true)
            else markWelcomed()            // already using the app: never show it
        })()
        return () => { live = false }
    }, [])

    function finish(action: StepAction | null) {
        setShow(false)
        markWelcomed()
        if (action) go(action, onGo)
    }

    if (!show) return null
    return (
        <Modal visible transparent animationType="fade" onRequestClose={() => finish(null)}>
            <View style={styles.overlay}>
                <ScrollView contentContainerStyle={styles.scroll}>
                    <View style={styles.card}>
                        {step === 1 ? (
                            <>
                                <Text style={styles.kicker}>Step 1 of 2</Text>
                                <Text style={styles.title} accessibilityRole="header">Welcome to Budget Tracker</Text>
                                <Text style={styles.lead}>A few things it does for you:</Text>
                                {POINTS.map(p => (
                                    <View key={p.text} style={styles.point}>
                                        <Ionicons name={p.icon as any} size={22} color={C.primary} />
                                        <Text style={styles.pointText}>{p.text}</Text>
                                    </View>
                                ))}
                                <View style={styles.buttons}>
                                    <Button label="Let's get started" onPress={() => setStep(2)} />
                                    <Button variant="ghost" label="Skip for now" onPress={() => finish(null)} />
                                </View>
                            </>
                        ) : (
                            <>
                                <Text style={styles.kicker}>Step 2 of 2</Text>
                                <Text style={styles.title} accessibilityRole="header">How would you like to add your transactions?</Text>
                                <Text style={styles.lead}>You can do more than one later.</Text>
                                {CHOICES.map(choice => (
                                    <TouchableOpacity key={choice.title} accessibilityRole="button" accessibilityLabel={choice.title}
                                        accessibilityHint={choice.help} onPress={() => finish(choice.action)} style={styles.choice}>
                                        <Ionicons name={choice.icon as any} size={24} color={C.primary} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.choiceTitle}>{choice.title}</Text>
                                            <Text style={styles.choiceHelp}>{choice.help}</Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={18} color={C.muted} />
                                    </TouchableOpacity>
                                ))}
                                <Text style={styles.note}>The getting-started list on the Dashboard has the next steps.</Text>
                                <View style={styles.buttons}>
                                    <Button variant="ghost" label="Back" onPress={() => setStep(1)} />
                                </View>
                            </>
                        )}
                    </View>
                </ScrollView>
            </View>
        </Modal>
    )
}

const makeStyles = (C: Palette) => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: C.scrim },
    scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
    card: {
        width: '100%', maxWidth: 520, backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 24, gap: 12,
        shadowColor: C.shadow, shadowOpacity: 0.2, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 10,
    },
    kicker: { fontSize: 12, fontWeight: '700', color: C.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
    title: { fontSize: 24, fontWeight: '700', color: C.ink, lineHeight: 30 },
    lead: { fontSize: 14, color: C.muted, marginBottom: 4 },
    point: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
    pointText: { flex: 1, fontSize: 15, color: C.text, lineHeight: 21 },
    choice: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: C.line },
    choiceTitle: { fontSize: 15, fontWeight: '600', color: C.ink },
    choiceHelp: { fontSize: 13, color: C.muted, lineHeight: 18, marginTop: 2 },
    note: { fontSize: 13, color: C.muted, marginTop: 4 },
    buttons: { gap: 6, marginTop: 8, alignItems: 'stretch' },
})
