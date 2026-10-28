// Privacy mode, for using the app in public: amounts are blurred (on the web) or shown as dots (in the
// phone app) until you point at one or tap it. Wrap just the amount, inside a Text:
//   <Text>Spent <Private kind="totals">{money(spent)}</Private></Text>
// You choose which kinds are hidden (Settings, Privacy mode).
import { ReactNode } from 'react'
import { Text, Platform } from 'react-native'
import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

const KEY = 'privacy'

/** The kinds of amounts privacy mode can hide. */
export type PrivateKind = 'balances' | 'totals' | 'budget' | 'transactions'
export const PRIVATE_KINDS: { value: PrivateKind; label: string; help: string }[] = [
    { value: 'balances', label: 'Bank balances', help: 'Checking, savings and what you owe on cards' },
    { value: 'totals', label: 'Totals and summaries', help: 'Spent, earned and left over, for a day, month or year' },
    { value: 'budget', label: 'Budget amounts', help: 'What you plan for each category' },
    { value: 'transactions', label: 'Transaction amounts', help: 'Each purchase, payment and subscription' },
]
export const DEFAULT_HIDDEN_KINDS: PrivateKind[] = ['balances', 'totals']

interface PrivacyState {
    hidden: boolean
    kinds: PrivateKind[]
    loaded: boolean
    toggle: () => void
    setKind: (kind: PrivateKind, hide: boolean) => void
    load: () => Promise<void>
}

export const usePrivacy = create<PrivacyState>((set, get) => {
    const save = () => AsyncStorage.setItem(KEY, JSON.stringify({ on: get().hidden, kinds: get().kinds })).catch(() => {})
    return {
        hidden: false,
        kinds: DEFAULT_HIDDEN_KINDS,
        loaded: false,
        toggle: () => { set({ hidden: !get().hidden, loaded: true }); save() },
        setKind: (kind, hide) => {
            const kinds = get().kinds.filter(k => k !== kind)
            set({ kinds: hide ? [...kinds, kind] : kinds, loaded: true })
            save()
        },
        load: async () => {
            if (get().loaded) return
            const raw = await AsyncStorage.getItem(KEY).catch(() => null)
            if (get().loaded) return
            let hidden = false, kinds = DEFAULT_HIDDEN_KINDS
            if (raw === 'on' || raw === 'off') hidden = raw === 'on'   // saved by the first version
            else if (raw) {
                try {
                    const saved = JSON.parse(raw)
                    hidden = !!saved.on
                    if (Array.isArray(saved.kinds)) kinds = saved.kinds.filter((k: any) => PRIVATE_KINDS.some(p => p.value === k))
                } catch {}
            }
            set({ hidden, kinds, loaded: true })
        },
    }
})

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

/** An amount that privacy mode may hide, depending on its kind and what you chose to hide. */
export function Private({ kind, children }: { kind: PrivateKind; children: ReactNode }) {
    const hide = usePrivacy(s => s.hidden && s.kinds.includes(kind))
    if (!hide) return <>{children}</>
    if (Platform.OS === 'web') {
        addWebStyle()
        return <Text {...({ dataSet: { private: 'on' } } as any)} focusable>{children}</Text>
    }
    return <Text>•••••</Text>
}
