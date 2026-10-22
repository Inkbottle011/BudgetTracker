// "A new version of the app is ready." Checks now and then (and when you come back to the tab), so you
// don't have to wonder whether the website has your latest changes.
import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, Platform } from 'react-native'
import { useStyles } from '../theme/theme'
import type { Palette } from '../theme/themes'
import { Button } from './ui'
import { checkForUpdate } from '../version'

const EVERY = 5 * 60 * 1000
const listeners = new Set<() => Promise<void>>()

export function UpdateBanner({ check = () => checkForUpdate(), reload = () => { if (typeof window !== 'undefined') window.location.reload() } }: {
    check?: () => Promise<'new' | 'same' | 'unknown'>
    reload?: () => void
}) {
    const s = useStyles(makeStyles)
    const [ready, setReady] = useState(false)
    useEffect(() => {
        let live = true
        const run = async () => { if ((await check()) === 'new' && live) setReady(true) }
        listeners.add(run)
        const timer = setInterval(run, EVERY)
        const onVisible = () => { if (typeof document !== 'undefined' && document.visibilityState === 'visible') run() }
        if (Platform.OS === 'web' && typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible)
        return () => {
            live = false
            listeners.delete(run)
            clearInterval(timer)
            if (Platform.OS === 'web' && typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible)
        }
    }, [])
    if (!ready) return null
    return (
        <View style={s.bar} accessibilityRole="alert">
            <Text style={s.text}>A new version of the app is ready.</Text>
            <Button small label="Reload" onPress={reload} />
        </View>
    )
}

/** Checks right away (Settings' "Check for updates"); the banner shows if there's a new version. */
UpdateBanner.checkNow = async () => { await Promise.all([...listeners].map(run => run())) }

const makeStyles = (C: Palette) => StyleSheet.create({
    bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap', backgroundColor: C.primarySoft, paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderColor: C.line },
    text: { fontSize: 14, fontWeight: '600', color: C.ink },
})
