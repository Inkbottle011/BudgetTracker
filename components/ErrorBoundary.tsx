import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'

interface State {
    hasError: boolean
    error: string
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
    constructor(props: any) {
        super(props)
        this.state = { hasError: false, error: '' }
    }
    
    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error: error.message }
    }
    
    componentDidCatch(error: Error, info: any) {
        console.error('Error boundary caught:', error, info)
    }
    
    render() {
        if (this.state.hasError) {
            return (
                <View style={styles.container}>
                <Text style={styles.title}>Something went wrong</Text>
                <Text style={styles.message}>{this.state.error}</Text>
                <TouchableOpacity
                style={styles.btn}
                onPress={() => this.setState({ hasError: false, error: '' })}
                >
                <Text style={styles.btnText}>Try Again</Text>
                </TouchableOpacity>
                </View>
            )
        }
        return this.props.children
    }
}

const styles = StyleSheet.create({
    container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#f5f6fa' },
    title: { fontSize: 22, fontWeight: '700', color: '#2c3e50', marginBottom: 12 },
    message: { fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 24 },
    btn: { backgroundColor: '#2c3e50', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
    btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
})