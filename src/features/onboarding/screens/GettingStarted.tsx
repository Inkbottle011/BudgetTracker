import { useCallback, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Section, Button } from '../../../shared/ui/ui'
import { useStyles, Palette } from '../../../shared/theme/theme'
import { loadProgress, stepsFrom, Progress } from '../logic/progress'
import { isChecklistHidden, setChecklistHidden } from '../logic/remember'
import { STEPS, go, Tab } from '../logic/steps'

/** The getting-started list on the Dashboard: what's left to set up, ticked off as you do it. */
export function GettingStarted({ onGo }: { onGo: (tab: Tab) => void }) {
    const styles = useStyles(makeStyles)
    const [progress, setProgress] = useState<Progress | null>(null)
    const [hidden, setHidden] = useState(true)

    // Checked again each time you come back to the Dashboard, so steps tick off as you do them
    useFocusEffect(useCallback(() => {
        let live = true
        Promise.all([isChecklistHidden(), loadProgress()]).then(([h, p]) => {
            if (!live) return
            setHidden(h)
            setProgress(p)
        })
        return () => { live = false }
    }, []))

    if (hidden || !progress) return null
    const steps = stepsFrom(progress)
    const done = steps.filter(s => s.done).length
    if (done === steps.length) return null

    function hide() {
        setHidden(true)
        setChecklistHidden(true)
    }

    return (
        <Section title="Getting started" action={<Button variant="ghost" small label="Hide" accessibilityLabel="Hide getting started" onPress={hide} />}>
            <Text style={styles.count}>{done} of {steps.length} done</Text>
            {steps.map((step, i) => {
                const info = STEPS[step.id]
                return (
                    <View key={step.id} style={[styles.step, i > 0 && styles.stepBorder]}
                        accessible={false}>
                        <View accessible accessibilityLabel={`${info.title}, ${step.done ? 'done' : 'not done yet'}`}
                            style={[styles.mark, step.done && styles.markDone]}>
                            <Text style={[styles.markText, step.done && styles.markTextDone]}>{step.done ? '✓' : i + 1}</Text>
                        </View>
                        <View style={styles.body}>
                            <Text style={[styles.title, step.done && styles.titleDone]}>{info.title}</Text>
                            {!step.done && (
                                <>
                                    <Text style={styles.help}>{info.help}</Text>
                                    <View style={styles.actions}>
                                        {info.actions.map((a, j) => (
                                            <Button key={a.label} small variant={j === 0 ? 'primary' : 'secondary'} label={a.label} onPress={() => go(a, onGo)} />
                                        ))}
                                    </View>
                                </>
                            )}
                        </View>
                    </View>
                )
            })}
            <Text style={styles.footer}>Don't need this? Hide it. You can bring it back in Settings.</Text>
        </Section>
    )
}

const makeStyles = (C: Palette) => StyleSheet.create({
    count: { fontSize: 13, color: C.muted, marginTop: -4, marginBottom: 6 },
    step: { flexDirection: 'row', gap: 12, paddingVertical: 12 },
    stepBorder: { borderTopWidth: 1, borderColor: C.line },
    mark: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
    markDone: { backgroundColor: C.good, borderColor: C.good },
    markText: { fontSize: 13, fontWeight: '700', color: C.muted },
    markTextDone: { color: C.surface },
    body: { flex: 1, gap: 4 },
    title: { fontSize: 15, fontWeight: '600', color: C.ink, lineHeight: 22 },
    titleDone: { color: C.muted, textDecorationLine: 'line-through' },
    help: { fontSize: 13, color: C.muted, lineHeight: 18 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
    footer: { fontSize: 12, color: C.muted, marginTop: 8 },
})
