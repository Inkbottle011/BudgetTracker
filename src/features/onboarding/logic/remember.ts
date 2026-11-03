// What this device remembers about getting started, separately for each person who signs in on it.
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../../../shared/supabase'

async function key(name: string): Promise<string> {
    let id = 'unknown'
    try { id = (await supabase.auth.getSession()).data.session?.user?.id ?? 'unknown' } catch {}
    return `${name}:${id}`
}

async function read(name: string): Promise<boolean> {
    try { return (await AsyncStorage.getItem(await key(name))) === 'yes' } catch { return false }
}

async function write(name: string, on: boolean): Promise<void> {
    try {
        const k = await key(name)
        if (on) await AsyncStorage.setItem(k, 'yes')
        else await AsyncStorage.removeItem(k)
    } catch {}
}

export const wasWelcomed = () => read('welcomed')
export const markWelcomed = () => write('welcomed', true)
export const isChecklistHidden = () => read('gettingStartedHidden')
export const setChecklistHidden = (hidden: boolean) => write('gettingStartedHidden', hidden)
