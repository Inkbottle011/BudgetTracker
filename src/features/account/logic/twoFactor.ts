// Two-factor sign-in with an authenticator app (Google Authenticator, 1Password, Authy...),
// using Supabase Auth's built-in support.
import { supabase } from '../../../shared/supabase'

export const CODE_ERROR = "That code didn't work. Check the time on your phone and try the newest code."
export const CODE_LENGTH_ERROR = 'Enter the 6-digit code from your authenticator app.'

/** Keeps just the digits, so "123 456" works. */
export function cleanCode(input: string): string {
    return input.replace(/\D/g, '').slice(0, 6)
}

async function factors() {
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (error) throw new Error(error.message)
    const all = (data?.all ?? []) as any[]
    let ready = all.filter(f => f.status === 'verified' && f.factor_type === 'totp')
    if (!ready.length) ready = (data?.totp ?? []) as any[]
    return { all, ready, verified: ready[0] ?? null }
}

/** An authenticator app set up for this account. You can have more than one (a backup). */
export interface Authenticator { id: string; name: string }

export async function twoFactorStatus(): Promise<{ on: boolean; factorId: string | null; authenticators: Authenticator[] }> {
    const { ready } = await factors()
    return {
        on: ready.length > 0,
        factorId: ready[0]?.id ?? null,
        authenticators: ready.map((f, i) => ({ id: f.id, name: f.friendly_name || (i === 0 ? 'Authenticator' : `Authenticator ${i + 1}`) })),
    }
}

/** Each authenticator needs its own name: the first, then a backup, then numbered. */
function nextName(taken: string[]) {
    if (!taken.includes('Authenticator')) return 'Authenticator'
    if (!taken.includes('Backup authenticator')) return 'Backup authenticator'
    for (let n = 3; ; n++) if (!taken.includes(`Authenticator ${n}`)) return `Authenticator ${n}`
}

/** Starts setup: returns the QR code to scan and the key to type in by hand. */
/**
 * Supabase returns the QR code as "data:image/svg+xml;utf-8,<svg ...>" with the SVG unencoded.
 * Browsers read the first "#" (in colors like #000000) as the start of a URL fragment and drop
 * the rest, so the image comes out blank. Encoding the SVG fixes it.
 */
export function qrImageUri(qr: string): string {
    const svgPrefix = /^data:image\/svg\+xml(;[^,]*)?,/i
    if (qr.trim().startsWith('<')) return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr.trim())}`
    const m = qr.match(svgPrefix)
    if (!m) return qr                                   // e.g. a base64 PNG: already fine
    const body = qr.slice(m[0].length)
    if (/;base64/i.test(m[0]) || !/[<>#"\s]/.test(body)) return qr   // already encoded
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(body)}`
}

export async function startTwoFactorSetup(): Promise<{ factorId: string; qrCode: string; secret: string }> {
    // A setup that was started but never confirmed would block a new one
    const { all, ready } = await factors()
    for (const f of all.filter(f => f.status !== 'verified')) await supabase.auth.mfa.unenroll({ factorId: f.id })

    const friendlyName = nextName(ready.map(f => f.friendly_name).filter(Boolean))
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName } as any)
    if (error || !data) throw new Error(error?.message ?? "Couldn't start two-factor setup")
    const d = data as any
    return { factorId: d.id, qrCode: qrImageUri(d.totp.qr_code), secret: d.totp.secret }
}

/** Checks a code for a factor; used to finish setup and to sign in. */
export async function verifyCode(factorId: string, input: string): Promise<void> {
    const code = cleanCode(input)
    if (code.length !== 6) throw new Error(CODE_LENGTH_ERROR)
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
    if (error) throw new Error(CODE_ERROR)
}

/** At sign-in: a code from any of your authenticators works. */
export async function verifySignInCode(input: string): Promise<void> {
    const { ready } = await factors()
    if (!ready.length) throw new Error('Two-factor sign-in is not set up for this account.')
    let lastError: unknown
    for (const f of ready) {
        try { return await verifyCode(f.id, input) } catch (e) { lastError = e }
    }
    throw lastError
}

/** Removes one authenticator. The last one can't be removed this way: turn two-factor sign-in off instead. */
export async function removeAuthenticator(factorId: string): Promise<void> {
    const { ready } = await factors()
    if (ready.length <= 1) throw new Error("That's your last one. To stop using two-factor sign-in, turn it off instead.")
    const { error } = await supabase.auth.mfa.unenroll({ factorId })
    if (error) throw new Error(error.message)
}

/** Turns two-factor sign-in off by removing every authenticator. */
export async function turnOffTwoFactor(): Promise<void> {
    const { all } = await factors()
    for (const f of all) {
        const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id })
        if (error) throw new Error(error.message)
    }
}

/** True when this account uses two-factor but the code hasn't been entered in this session yet. */
export async function needsTwoFactorCode(): Promise<boolean> {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (error || !data) return false
    return data.nextLevel === 'aal2' && data.currentLevel !== 'aal2'
}
