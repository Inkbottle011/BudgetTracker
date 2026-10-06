// Teller Connect: Teller's own sign-in window where people log in to their bank.
// The app never sees bank passwords; it only receives a token that goes straight to the server.
// Docs: https://teller.io/docs/guides/connect
import { Platform } from 'react-native'

const APP_ID = process.env.EXPO_PUBLIC_TELLER_APP_ID
const ENVIRONMENT = process.env.EXPO_PUBLIC_TELLER_ENV || 'sandbox'

export interface TellerEnrollment {
    accessToken: string
    enrollment: { id: string; institution?: { name?: string } }
}

/** Linking uses Teller's web sign-in, so it's available on the website once an app ID is set. */
export function bankLinkingAvailable(): boolean {
    return Platform.OS === 'web' && !!APP_ID
}

let scriptLoading: Promise<void> | null = null
function loadScript(): Promise<void> {
    if ((globalThis as any).TellerConnect) return Promise.resolve()
    scriptLoading ??= new Promise((resolve, reject) => {
        const s = document.createElement('script')
        s.src = 'https://cdn.teller.io/connect/connect.js'
        s.onload = () => resolve()
        s.onerror = () => { scriptLoading = null; reject(new Error("Couldn't load Teller's sign-in. Check your connection.")) }
        document.body.appendChild(s)
    })
    return scriptLoading
}

/** Opens Teller's sign-in. Resolves with the enrollment, or null if the person closed it. */
export async function openTellerConnect(): Promise<TellerEnrollment | null> {
    if (!bankLinkingAvailable()) throw new Error('Bank linking is only available on the website.')
    await loadScript()
    return new Promise(resolve => {
        const connect = (globalThis as any).TellerConnect.setup({
            applicationId: APP_ID,
            environment: ENVIRONMENT,
            products: ['transactions', 'balance'],
            onSuccess: (enrollment: TellerEnrollment) => resolve(enrollment),
            onExit: () => resolve(null),
        })
        connect.open()
    })
}
