// Encrypts bank access tokens before they're stored, with AES-256-GCM.
// The key (BANK_TOKEN_KEY) lives only in the server function's secrets, so a copy of the
// database alone is not enough to use any token.

function toBase64(bytes: Uint8Array): string {
    let s = ''
    for (const b of bytes) s += String.fromCharCode(b)
    return btoa(s)
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
    const s = atob(b64)
    const out = new Uint8Array(new ArrayBuffer(s.length))
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
    return out
}

async function importKey(keyB64: string): Promise<CryptoKey> {
    let raw: Uint8Array<ArrayBuffer>
    try { raw = fromBase64(keyB64) } catch { raw = new Uint8Array(new ArrayBuffer(0)) }
    if (raw.length !== 32) {
        throw new Error('BANK_TOKEN_KEY must be 32 bytes, base64-encoded (generate one with: openssl rand -base64 32)')
    }
    return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

/** Returns "v1:<iv>:<ciphertext>". A fresh random IV every time, so equal tokens look different. */
export async function encryptToken(token: string, keyB64: string): Promise<string> {
    const key = await importKey(keyB64)
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(token)))
    return `v1:${toBase64(iv)}:${toBase64(ct)}`
}

/** Fails if the key is wrong or the stored value was changed. */
export async function decryptToken(stored: string, keyB64: string): Promise<string> {
    const [version, ivB64, ctB64] = String(stored).split(':')
    if (version !== 'v1' || !ivB64 || !ctB64) throw new Error('Unrecognized encrypted token format')
    const key = await importKey(keyB64)
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(ivB64) }, key, fromBase64(ctB64))
    return new TextDecoder().decode(plain)
}
