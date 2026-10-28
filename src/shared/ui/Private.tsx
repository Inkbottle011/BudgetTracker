// Privacy mode, for using the app in public: amounts are blurred (on the web) or shown as dots (in the
// phone app) until you point at one or tap it. Wrap just the amount, inside a Text:
//   <Text>Spent <Private>{money(spent)}</Private></Text>
import { ReactNode } from 'react'
import { Text, Platform } from 'react-native'
import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

const KEY = 'privacy'

export const usePrivacy = create<{ hidden: boolean; loaded: boolean; toggle: () => void; load: () => Promise<void> }>((set, get) => ({
    hidden: false,
    loaded: false,
    toggle: () => {
        const hidden = !get().hidden
        set({ hidden, loaded: true })
        AsyncStorage.setItem(KEY, hidden ? 'on' : 'off').catch(() => {})
    },
    load: async () => {
        if (get().loaded) return
        const saved = await AsyncStorage.getItem(KEY).catch(() => null)
        if (!get().loaded) set({ hidden: saved === 'on', loaded: true })
    },
}))

// On the web: blurred until the pointer is over it, or it's tapped or tabbed to (which focuses it)
let styled = false
function addWebStyle() {
    if (styled || typeof document === 'undefined') return
    styled = true
    const style = document.createElement('style')
    style.textContent = `
[data-private="on"] { filter: blur(0.42em); display: inline-block; cursor: pointer; border-radius: 4px; transition: filter .15s ease; user-select: none; }
[data-private="on"]:hover, [data-private="on"]:focus { filter: none; outline: none; user-select: auto; }
@media (prefers-reduced-motion: reduce) { [data-private="on"] { transition: none; } }`
    document.head.appendChild(style)
}

export function Private({ children }: { children: ReactNode }) {
    const hidden = usePrivacy(s => s.hidden)
    if (!hidden) return <>{children}</>
    if (Platform.OS === 'web') {
        addWebStyle()
        return <Text {...({ dataSet: { private: 'on' } } as any)} focusable>{children}</Text>
    }
    return <Text>•••••</Text>
}
