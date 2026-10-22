// A choice remembered on this device (like which view you last used), read back next time.
import { useEffect, useRef, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * Like useState, but saved on this device under `key`. `allowed` (optional) lists the values that make
 * sense; anything else saved is ignored. A choice made before the saved one is read wins.
 */
export function usePersistentState<T>(key: string, initial: T, allowed?: readonly T[]): [T, (v: T) => void] {
    const [value, setValue] = useState<T>(initial)
    const chosen = useRef(false)
    useEffect(() => {
        let live = true
        AsyncStorage.getItem(key).then(raw => {
            if (!live || chosen.current || raw == null) return
            try {
                const saved = JSON.parse(raw) as T
                if (!allowed || allowed.some(a => JSON.stringify(a) === JSON.stringify(saved))) setValue(saved)
            } catch {}
        }).catch(() => {})
        return () => { live = false }
    }, [key])
    const set = (v: T) => {
        chosen.current = true
        setValue(v)
        AsyncStorage.setItem(key, JSON.stringify(v)).catch(() => {})
    }
    return [value, set]
}
