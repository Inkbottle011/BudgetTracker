import { useState } from 'react'
import { ScrollView, Text, StyleSheet } from 'react-native'
import { TwoFactorSection } from '../components/TwoFactorSection'
import { LinkedBanksSection } from '../components/LinkedBanksSection'

export default function SettingsScreen() {
    const [twoFactorOn, setTwoFactorOn] = useState(false)
    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Text style={styles.heading}>Settings</Text>
            <TwoFactorSection onChange={setTwoFactorOn} />
            <LinkedBanksSection twoFactorOn={twoFactorOn} />
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f6fa' },
    content: { padding: 20, maxWidth: 720, width: '100%', alignSelf: 'center' },
    heading: { fontSize: 24, fontWeight: '700', color: '#1a1a1a', marginBottom: 16 },
})
