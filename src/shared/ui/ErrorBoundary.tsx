import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useStyles, Palette } from '../theme/theme'
import { Button } from './ui'

interface State {
    hasError: boolean
    error: string
}

/** Instead of a blank screen when something breaks, says so and offers to try again. */
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
            return <ErrorScreen error={this.state.error} onRetry={() => this.setState({ hasError: false, error: '' })} />
        }
        return this.props.children
    }
}

function ErrorScreen({ error, onRetry }: { error: string; onRetry: () => void }) {
    const styles = useStyles(makeStyles)
    return (
        <View style={styles.page}>
            <View style={styles.card}>
                <Text style={styles.title} accessibilityRole="header">Something went wrong</Text>
                <Text style={styles.body}>
                    This screen hit a problem. Your data is safe. Try again, and if it keeps happening, reload the app.
                </Text>
                {error ? <Text style={styles.detail} selectable>{error}</Text> : null}
                <Button label="Try again" onPress={onRetry} style={styles.button} />
            </View>
        </View>
    )
}

const makeStyles = (C: Palette) => StyleSheet.create({
    page: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: C.page },
    card: { width: '100%', maxWidth: 420, backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 24, alignItems: 'center' },
    title: { fontSize: 20, fontWeight: '700', color: C.ink, marginBottom: 8, textAlign: 'center' },
    body: { fontSize: 14, color: C.text, textAlign: 'center', lineHeight: 20 },
    detail: { fontSize: 12, color: C.muted, textAlign: 'center', marginTop: 10 },
    button: { marginTop: 20, alignSelf: 'stretch' },
})
