import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { TwoFactorSection } from '../components/TwoFactorSection'
import { LinkedBanksSection } from '../components/LinkedBanksSection'
import { Page, PageTitle, Section, Segmented } from '../components/ui'
import { useTheme, useStyles, Palette, Preference } from '../lib/theme'
import { SCENES, SPEEDS, AMOUNTS, TINTS, tintSwatch, Scene, Speed, Amount } from '../lib/background'
import { THEME_LIST, Theme } from '../lib/themes'

const APPEARANCE: { value: Preference; label: string }[] = [
    { value: 'system', label: 'Match device' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
]

export default function SettingsScreen() {
    const { preference, setPreference, themeId, setThemeId, scheme } = useTheme()
    const styles = useStyles(makeStyles)
    const [twoFactorOn, setTwoFactorOn] = useState(false)
    return (
        <Page maxWidth={720}>
            <PageTitle title="Settings" />
            <Section title="Appearance">
                <Text style={styles.groupLabel}>Theme</Text>
                <View style={styles.themes}>
                    {THEME_LIST.map(t => (
                        <ThemeChoice key={t.id} theme={t} mode={scheme} selected={themeId === t.id} onPress={() => setThemeId(t.id)} />
                    ))}
                </View>
                <Text style={[styles.groupLabel, styles.groupGap]}>Light or dark</Text>
                <Segmented<Preference> value={preference} onChange={setPreference} options={APPEARANCE} />
                <Text style={styles.help}>Match device follows your phone or computer's light or dark setting. Picking a theme also sets the moving background's color.</Text>
            </Section>
            <BackgroundSection />
            <TwoFactorSection onChange={setTwoFactorOn} />
            <LinkedBanksSection twoFactorOn={twoFactorOn} />
        </Page>
    )
}

/** A small preview of a theme: its top bar, a button and a budget bar, with its name. */
function ThemeChoice({ theme, mode, selected, onPress }: { theme: Theme; mode: 'light' | 'dark'; selected: boolean; onPress: () => void }) {
    const styles = useStyles(makeStyles)
    const p = theme[mode]
    return (
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${theme.name} theme`} accessibilityState={{ selected }}
            onPress={onPress} style={[styles.themeCard, selected && styles.themeCardOn]}>
            <View style={[styles.preview, { backgroundColor: p.page, borderColor: p.line }]}>
                <View style={[styles.previewBar, { backgroundColor: p.bar }]} />
                <View style={styles.previewBody}>
                    <View style={[styles.previewPanel, { backgroundColor: p.panel }]} />
                    <View style={[styles.previewTrack, { backgroundColor: p.track }]}>
                        <View style={[styles.previewFill, { backgroundColor: p.paceMark }]} />
                    </View>
                    <View style={[styles.previewButton, { backgroundColor: p.primary }]} />
                </View>
            </View>
            <Text style={[styles.themeName, selected && styles.themeNameOn]}>{theme.name}</Text>
        </TouchableOpacity>
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
                    {background.scene !== 'warp' && (
                        <View style={styles.option}>
                            <Text style={styles.label}>Extras</Text>
                            <View style={styles.toggles}>
                                <Toggle label="Shooting stars" on={background.shootingStars} onChange={shootingStars => setBackground({ shootingStars })} />
                                <Toggle label="Planets" on={background.planets} onChange={planets => setBackground({ planets })} />
                            </View>
                        </View>
                    )}
                </View>
            )}
            <Text style={styles.help}>
                {on
                    ? 'Stars drift slowly past a faint Milky Way, Warp flies through them, Nebula adds drifting clouds. It holds still if your device is set to reduce motion.'
                    : 'Choose a scene to show a moving starry sky behind your pages.'}
            </Text>
        </Section>
    )
}

/** A labelled on/off switch. */
function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
    const styles = useStyles(makeStyles)
    return (
        <TouchableOpacity accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: on }}
            onPress={() => onChange(!on)} style={styles.toggle} hitSlop={4}>
            <View style={[styles.track, on && styles.trackOn]}>
                <View style={[styles.knob, on && styles.knobOn]} />
            </View>
            <Text style={styles.toggleText}>{label}</Text>
        </TouchableOpacity>
    )
}

const makeStyles = (C: Palette) => StyleSheet.create({
    help: { fontSize: 13, color: C.muted, marginTop: 10, lineHeight: 18 },
    groupLabel: { fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 8 },
    groupGap: { marginTop: 18 },
    themes: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    themeCard: { width: 104, borderRadius: 12, borderWidth: 2, borderColor: 'transparent', padding: 4, alignItems: 'center', gap: 6 },
    themeCardOn: { borderColor: C.primary },
    preview: { width: '100%', height: 64, borderRadius: 8, borderWidth: 1, overflow: 'hidden' },
    previewBar: { height: 12 },
    previewBody: { flex: 1, padding: 6, gap: 4 },
    previewPanel: { height: 14, borderRadius: 3 },
    previewTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
    previewFill: { height: 4, width: '60%' },
    previewButton: { height: 8, width: 30, borderRadius: 4 },
    themeName: { fontSize: 13, color: C.text, fontWeight: '500', paddingBottom: 2 },
    themeNameOn: { color: C.ink, fontWeight: '700' },
    options: { marginTop: 14, gap: 12 },
    option: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
    label: { fontSize: 13, fontWeight: '600', color: C.text, width: 80 },
    swatches: { flexDirection: 'row', gap: 8 },
    swatchRing: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
    swatchRingOn: { borderColor: C.primary },
    swatch: { width: 24, height: 24, borderRadius: 12 },
    toggles: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
    toggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    toggleText: { fontSize: 13, color: C.text },
    track: { width: 36, height: 20, borderRadius: 10, backgroundColor: C.track, padding: 2, justifyContent: 'center' },
    trackOn: { backgroundColor: C.primary },
    knob: { width: 16, height: 16, borderRadius: 8, backgroundColor: C.surface },
    knobOn: { alignSelf: 'flex-end' },
})
