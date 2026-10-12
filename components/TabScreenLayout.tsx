// Wraps each tab's screen. Tabs you've left stay loaded (so they open instantly) but are hidden,
// because with the moving background on, pages are see-through and the old one would show behind.
import { ReactNode } from 'react'
import { View } from 'react-native'
import { useIsFocused } from '@react-navigation/native'

function OnlyWhenOpen({ children }: { children: ReactNode }) {
    const open = useIsFocused()
    return <View style={{ flex: 1, display: open ? 'flex' : 'none' }}>{children}</View>
}

export const tabScreenLayout = ({ children }: { children: ReactNode }) => <OnlyWhenOpen>{children}</OnlyWhenOpen>
