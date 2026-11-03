import { useEffect, useState } from 'react'
import { Text } from 'react-native'
import { Section, Button } from '../../../shared/ui/ui'
import { useTheme } from '../../../shared/theme/theme'
import { isChecklistHidden, setChecklistHidden } from '../logic/remember'

/** In Settings, only after the getting-started list was hidden: a way to bring it back. */
export function ShowGettingStartedAgain() {
    const { c: C } = useTheme()
    const [hidden, setHidden] = useState(false)
    const [back, setBack] = useState(false)
    useEffect(() => { isChecklistHidden().then(setHidden) }, [])
    if (!hidden && !back) return null
    return (
        <Section title="Getting started">
            {back
                ? <Text style={{ fontSize: 13, color: C.muted }}>It's back on the Dashboard.</Text>
                : <Button small variant="secondary" label="Show the getting-started list" style={{ alignSelf: 'flex-start' }}
                    onPress={async () => { await setChecklistHidden(false); setHidden(false); setBack(true) }} />}
        </Section>
    )
}
