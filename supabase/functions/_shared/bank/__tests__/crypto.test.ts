/** @jest-environment node */
import { encryptToken, decryptToken } from '../crypto.ts'

const KEY = Buffer.alloc(32, 7).toString('base64')
const OTHER_KEY = Buffer.alloc(32, 9).toString('base64')

describe('bank token encryption', () => {
    it('round-trips a token', async () => {
        const enc = await encryptToken('token_abc123', KEY)
        expect(await decryptToken(enc, KEY)).toBe('token_abc123')
    })

    it('never stores the token in readable form, and differs every time', async () => {
        const a = await encryptToken('token_abc123', KEY)
        const b = await encryptToken('token_abc123', KEY)
        expect(a).not.toContain('token_abc123')
        expect(a).toMatch(/^v1:[^:]+:[^:]+$/)
        expect(a).not.toBe(b)
    })

    it('cannot be read with the wrong key', async () => {
        const enc = await encryptToken('token_abc123', KEY)
        await expect(decryptToken(enc, OTHER_KEY)).rejects.toThrow()
    })

    it('detects tampering', async () => {
        const enc = await encryptToken('token_abc123', KEY)
        const [v, iv, ct] = enc.split(':')
        const flipped = ct.slice(0, -2) + (ct.slice(-2) === 'AA' ? 'AB' : 'AA')
        await expect(decryptToken(`${v}:${iv}:${flipped}`, KEY)).rejects.toThrow()
    })

    it('refuses a key that is not 32 bytes, with a helpful message', async () => {
        await expect(encryptToken('x', 'short')).rejects.toThrow(/BANK_TOKEN_KEY must be 32 bytes/)
    })

    it('refuses values it did not produce', async () => {
        await expect(decryptToken('plain-token', KEY)).rejects.toThrow(/Unrecognized/)
    })
})
