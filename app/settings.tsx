import { useState } from 'react'
import { Text, StyleSheet } from 'react-native'
import { TwoFactorSection } from '../components/TwoFactorSection'
import { LinkedBanksSection } from '../components/LinkedBanksSection'
import { Page, PageTitle, Section, Segmented } from '../components/ui'
import { useTheme, useStyles, Palette, Preference } from '../lib/theme'

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
            <TwoFactorSection onChange={setTwoFactorOn} />
            <LinkedBanksSection twoFactorOn={twoFactorOn} />
        </Page>
    )
}

const makeStyles = (C: Palette) => StyleSheet.create({
    help: { fontSize: 13, color: C.muted, marginTop: 10, lineHeight: 18 },
})
