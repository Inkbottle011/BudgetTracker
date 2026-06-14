import { View, Text, StyleSheet } from 'react-native'

export default function SettingsScreen() {
    return (
        <View style={styles.container}>
        <Text style={styles.heading}>Settings</Text>
        <Text style={styles.sub}>App preferences coming soon.</Text>
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f6fa', padding: 20 },
    heading: { fontSize: 24, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
    sub: { fontSize: 14, color: '#888' },
})