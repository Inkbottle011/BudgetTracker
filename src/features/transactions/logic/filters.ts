// What the transaction list is filtered to (type, category, dates). Kept in one place so other pages can
// open the list already filtered, and saved on this device so it's the same next time.
import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { DatePreset, presetRange } from './listLogic'
import { localToday } from '../../../shared/dates'

const KEY = 'transactionFilters'

interface Saved {
    type: string | null
    category: string | null
    preset: DatePreset
    /** Only used with the 'custom' preset */
    from: string
    to: string
}

interface FilterState extends Saved {
    loaded: boolean
    set: (patch: Partial<Saved>) => void
    clear: () => void
    /** Reads what was saved on this device (once) */
    load: () => Promise<void>
    /** Forgets everything in memory (not what's saved), as on a fresh start */
    reset: () => void
}

const EMPTY: Saved = { type: null, category: null, preset: 'all', from: '', to: '' }
const pick = (s: Saved): Saved => ({ type: s.type, category: s.category, preset: s.preset, from: s.from, to: s.to })

export const useTransactionFilters = create<FilterState>((set, get) => ({
    ...EMPTY,
    loaded: false,
    set: patch => {
        set({ ...patch, loaded: true })
        AsyncStorage.setItem(KEY, JSON.stringify(pick(get()))).catch(() => {})
    },
    clear: () => get().set(EMPTY),
    load: async () => {
        if (get().loaded) return
        let saved: Partial<Saved> = {}
        try { saved = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '{}') ?? {} } catch {}
        if (get().loaded) return   // something was chosen while reading
        set({ ...EMPTY, ...saved, loaded: true })
    },
    reset: () => set({ ...EMPTY, loaded: false }),
}))

/** The dates the list is limited to right now. */
export function activeRange(f: Pick<Saved, 'preset' | 'from' | 'to'>, today = localToday()): { from: string; to: string } {
    return f.preset === 'custom' ? { from: f.from, to: f.to } : presetRange(f.preset, today)
}

/** Opens the list filtered to a category and dates (the caller then goes to the Transactions page). */
export function showTransactionsFor({ category, from, to }: { category: string | null; from: string; to: string }) {
    useTransactionFilters.getState().set({ type: null, category, preset: 'custom', from, to })
}
