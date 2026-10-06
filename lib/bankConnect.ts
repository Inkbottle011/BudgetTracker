// The bank's sign-in window. People log in to their bank there; the app never sees bank passwords.
//   Plaid (default): https://plaid.com/docs/link/web/ — needs a session from the server first, and
//                    returns a one-time token that the server exchanges for a lasting one.
//   Teller:          https://teller.io/docs/guides/connect — returns the lasting token directly.
import { Platform } from 'react-native'
import { callBank } from './bank'

// Read with the full name so Expo builds the values into the website
const PROVIDER = process.env.EXPO_PUBLIC_BANK_PROVIDER || 'plaid'
const TELLER_APP_ID = process.env.EXPO_PUBLIC_TELLER_APP_ID
const TELLER_ENV = process.env.EXPO_PUBLIC_TELLER_ENV || 'sandbox'

/** What the sign-in window gives back, ready to send to the server's "link" action. */
export interface BankLinkResult {
    institutionName?: string
    publicToken?: string       // Plaid
    accessToken?: string       // Teller
    enrollmentId?: string      // Teller
}

/** Linking uses the provider's web sign-in window, so it's available on the website. */
export function bankLinkingAvailable(): boolean {
    if (Platform.OS !== 'web') return false
    return PROVIDER === 'teller' ? !!TELLER_APP_ID : true
}

const loading: Record<string, Promise<void>> = {}
function loadScript(src: string, globalName: string): Promise<void> {
    if ((globalThis as any)[globalName]) return Promise.resolve()
    loading[src] ??= new Promise((resolve, reject) => {
        const s = document.createElement('script')
        s.src = src
        s.onload = () => resolve()
        s.onerror = () => { delete loading[src]; reject(new Error("Couldn't load the bank sign-in. Check your connection.")) }
        document.body.appendChild(s)
    })
    return loading[src]
}

/** Opens the bank sign-in. Resolves with what to send to the server, or null if the person closed it. */
export async function openBankConnect(): Promise<BankLinkResult | null> {
    if (!bankLinkingAvailable()) throw new Error('Bank linking is only available on the website.')
    return PROVIDER === 'teller' ? openTeller() : openPlaid()
}

async function openPlaid(): Promise<BankLinkResult | null> {
    const { linkToken } = await callBank('link-session')
    if (!linkToken) throw new Error("Couldn't start the bank sign-in. Please try again.")
    await loadScript('https://cdn.plaid.com/link/v2/stable/link-initialize.js', 'Plaid')
    return new Promise(resolve => {
        const handler = (globalThis as any).Plaid.create({
            token: linkToken,
            onSuccess: (publicToken: string, metadata: any) =>
                resolve({ publicToken, institutionName: metadata?.institution?.name ?? undefined }),
            onExit: () => resolve(null),
        })
        handler.open()
    })
}

async function openTeller(): Promise<BankLinkResult | null> {
    await loadScript('https://cdn.teller.io/connect/connect.js', 'TellerConnect')
    return new Promise(resolve => {
        const connect = (globalThis as any).TellerConnect.setup({
            applicationId: TELLER_APP_ID,
            environment: TELLER_ENV,
            products: ['transactions', 'balance'],
            onSuccess: (e: any) => resolve({ accessToken: e.accessToken, enrollmentId: e.enrollment?.id, institutionName: e.enrollment?.institution?.name }),
            onExit: () => resolve(null),
        })
        connect.open()
    })
}
