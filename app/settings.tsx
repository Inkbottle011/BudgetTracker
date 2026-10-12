import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { TwoFactorSection } from '../components/TwoFactorSection'
import { LinkedBanksSection } from '../components/LinkedBanksSection'
import { Page, PageTitle, Section, Segmented } from '../components/ui'
import { useTheme, useStyles, Palette, Preference } from '../lib/theme'
import { SCENES, SPEEDS, AMOUNTS, TINTS, tintSwatch, Scene, Speed, Amount } from '../lib/background'

const APPEARANCE: { value: Preference; label: string }[] = [
    { value: 'system', label: 'Match device' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
]

export default function SettingsScreen() {
    const { preference, setPreference } = useTheme()
    const styles = useStyles(makeStyles)
    const [twoFactorOn, setTwoFactorOn] = useState(false)
    return (
        <Page maxWidth={720}>
            <PageTitle title="Settings" />
            <Section title="Appearance">
                <Segmented<Preference> value={preference} onChange={setPreference} options={APPEARANCE} />
                <Text style={styles.help}>Match device follows your phone or computer's light or dark setting.</Text>
            </Section>
            <BackgroundSection />
            <TwoFactorSection onChange={setTwoFactorOn} />
            <LinkedBanksSection twoFactorOn={twoFactorOn} />
        </Page>
    )
}

/** Settings for the moving space background. */
function BackgroundSection() {
    const { background, setBackground } = useTheme()
    const styles = useStyles(makeStyles)
    const on = background.scene !== 'off'
    return (
        <Section title="Moving background">
            <Segmented<Scene> value={background.scene} onChange={scene => setBackground({ scene })} options={SCENES} />
            {on && (
                <View style={styles.options}>
                    <View style={styles.option}>
                        <Text style={styles.label}>Speed</Text>
                        <Segmented<Speed> value={background.speed} onChange={speed => setBackground({ speed })} options={SPEEDS} />
                    </View>
                    <View style={styles.option}>
                        <Text style={styles.label}>How many</Text>
                        <Segmented<Amount> value={background.amount} onChange={amount => setBackground({ amount })} options={AMOUNTS} />
                    </View>
                    <View style={styles.option}>
                        <Text style={styles.label}>Color</Text>
                        <View style={styles.swatches}>
                            {TINTS.map(t => {
                                const selected = background.tint === t.value
                                return (
                                    <TouchableOpacity key={t.value} accessibilityRole="button" accessibilityLabel={t.label}
                                        accessibilityState={{ selected }} onPress={() => setBackground({ tint: t.value })}
                                        style={[styles.swatchRing, selected && styles.swatchRingOn]} hitSlop={4}>
                                        <View style={[styles.swatch, { backgroundColor: tintSwatch(t.value) }]} />
                                    </TouchableOpacity>
                                )
                            })}
                        </View>
                    </View>
                </View>
            )}
            <Text style={styles.help}>
                {on
                    ? 'Stars drift slowly, Warp flies through them, Nebula adds drifting clouds. It holds still if your device is set to reduce motion.'
                    : 'Choose a scene to show a moving starry sky behind your pages.'}
            </Text>
        </Section>
    )
}

const makeStyles = (C: Palette) => StyleSheet.create({
    help: { fontSize: 13, color: C.muted, marginTop: 10, lineHeight: 18 },
    options: { marginTop: 14, gap: 12 },
    option: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
    label: { fontSize: 13, fontWeight: '600', color: C.text, width: 80 },
    swatches: { flexDirection: 'row', gap: 8 },
    swatchRing: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
    swatchRingOn: { borderColor: C.primary },
    swatch: { width: 24, height: 24, borderRadius: 12 },
})
