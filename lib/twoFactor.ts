// Two-factor sign-in with an authenticator app (Google Authenticator, 1Password, Authy...),
// using Supabase Auth's built-in support.
import { supabase } from './supabase'

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
    return { all, verified: all.find(f => f.status === 'verified' && f.factor_type === 'totp') ?? (data?.totp ?? [])[0] ?? null }
}

export async function twoFactorStatus(): Promise<{ on: boolean; factorId: string | null }> {
    const { verified } = await factors()
    return { on: !!verified, factorId: verified?.id ?? null }
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
    const { all } = await factors()
    for (const f of all.filter(f => f.status !== 'verified')) await supabase.auth.mfa.unenroll({ factorId: f.id })

    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Authenticator' } as any)
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

/** At sign-in: verifies the code against the user's authenticator. */
export async function verifySignInCode(input: string): Promise<void> {
    const { verified } = await factors()
    if (!verified) throw new Error('Two-factor sign-in is not set up for this account.')
    await verifyCode(verified.id, input)
}

export async function turnOffTwoFactor(factorId: string): Promise<void> {
    const { error } = await supabase.auth.mfa.unenroll({ factorId })
    if (error) throw new Error(error.message)
}

/** True when this account uses two-factor but the code hasn't been entered in this session yet. */
export async function needsTwoFactorCode(): Promise<boolean> {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (error || !data) return false
    return data.nextLevel === 'aal2' && data.currentLevel !== 'aal2'
}
