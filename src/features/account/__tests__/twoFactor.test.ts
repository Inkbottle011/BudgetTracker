jest.mock('../../../shared/supabase', () => require('../../../../test/fakeSupabase').module)
import { qrImageUri } from '../logic/twoFactor'

describe('qrImageUri', () => {
    // What Supabase actually returns: raw SVG after the comma, with "#" colors that browsers
    // treat as the start of a URL fragment, cutting the image off
    const raw = 'data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path fill="#000000" d="M0 0h1v1H0z"/></svg>'

    it('encodes the SVG so browsers show the whole image', () => {
        const uri = qrImageUri(raw)
        expect(uri.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true)
        expect(uri).not.toContain('#')
        expect(decodeURIComponent(uri.slice(uri.indexOf(',') + 1))).toBe(raw.slice(raw.indexOf(',') + 1))
    })

    it('leaves images that are already encoded alone', () => {
        expect(qrImageUri('data:image/png;base64,iVBORw0KGgo=')).toBe('data:image/png;base64,iVBORw0KGgo=')
        const encoded = qrImageUri(raw)
        expect(qrImageUri(encoded)).toBe(encoded)
    })

    it('wraps a bare SVG too', () => {
        expect(qrImageUri('<svg fill="#fff"/>')).toBe(`data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg fill="#fff"/>')}`)
    })
})

describe('more than one authenticator (a backup)', () => {
    const { twoFactorStatus, startTwoFactorSetup, verifySignInCode, turnOffTwoFactor, removeAuthenticator } = require('../logic/twoFactor')
    const { auth } = require('../../../../test/fakeSupabase')
    const mfa = auth.mfa as Record<string, jest.Mock>
    const factor = (id: string, name: string, status = 'verified') => ({ id, friendly_name: name, factor_type: 'totp', status, created_at: '2026-10-01' })
    const have = (...list: any[]) => mfa.listFactors.mockResolvedValue({ data: { all: list, totp: list.filter(f => f.status === 'verified') }, error: null })

    beforeEach(() => { Object.values(mfa).forEach(m => m.mockClear?.()); mfa.challengeAndVerify.mockResolvedValue({ data: {}, error: null }) })

    it('lists every authenticator', async () => {
        have(factor('a', 'Authenticator'), factor('b', 'Backup authenticator'))
        expect(await twoFactorStatus()).toEqual({
            on: true, factorId: 'a',
            authenticators: [{ id: 'a', name: 'Authenticator' }, { id: 'b', name: 'Backup authenticator' }],
        })
    })

    it('gives a second one its own name (they must differ)', async () => {
        have(factor('a', 'Authenticator'))
        await startTwoFactorSetup()
        expect(mfa.enroll).toHaveBeenCalledWith({ factorType: 'totp', friendlyName: 'Backup authenticator' })
        have(factor('a', 'Authenticator'), factor('b', 'Backup authenticator'))
        await startTwoFactorSetup()
        expect(mfa.enroll).toHaveBeenLastCalledWith({ factorType: 'totp', friendlyName: 'Authenticator 3' })
    })

    it('accepts a code from any of them at sign-in', async () => {
        have(factor('a', 'Authenticator'), factor('b', 'Backup authenticator'))
        mfa.challengeAndVerify.mockImplementation(async ({ factorId }: any) => factorId === 'b' ? { data: {}, error: null } : { data: null, error: { message: 'Invalid TOTP code entered' } })
        await expect(verifySignInCode('123456')).resolves.toBeUndefined()
        mfa.challengeAndVerify.mockResolvedValue({ data: null, error: { message: 'Invalid TOTP code entered' } })
        await expect(verifySignInCode('123456')).rejects.toThrow("That code didn't work")
    })

    it('removes one, but never the last (turning off is separate)', async () => {
        have(factor('a', 'Authenticator'), factor('b', 'Backup authenticator'))
        await removeAuthenticator('b')
        expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: 'b' })
        have(factor('a', 'Authenticator'))
        await expect(removeAuthenticator('a')).rejects.toThrow(/last one/)
    })

    it('turning off removes them all', async () => {
        have(factor('a', 'Authenticator'), factor('b', 'Backup authenticator'))
        await turnOffTwoFactor()
        expect(mfa.unenroll.mock.calls.map((c: any) => c[0].factorId).sort()).toEqual(['a', 'b'])
    })
})
