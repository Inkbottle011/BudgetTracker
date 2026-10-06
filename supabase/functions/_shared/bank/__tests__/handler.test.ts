/** @jest-environment node */
import { handleBankRequest, type HandlerEnv } from '../handler.ts'

/** A fake signed-in session token, shaped like Supabase's (only the payload matters here). */
function jwt(claims: Record<string, unknown>) {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
    return `${b64({ alg: 'none' })}.${b64(claims)}.sig`
}

function request(body: unknown, headers: Record<string, string> = {}, method = 'POST') {
    return new Request('https://x.supabase.co/functions/v1/bank', {
        method, headers: { 'content-type': 'application/json', ...headers }, body: method === 'POST' ? JSON.stringify(body) : undefined,
    })
}

const ALICE_2FA = { authorization: `Bearer ${jwt({ sub: 'alice', aal: 'aal2' })}` }
const ALICE_NO_2FA = { authorization: `Bearer ${jwt({ sub: 'alice', aal: 'aal1' })}` }

function env(over: Partial<HandlerEnv> = {}) {
    const service = {
        linkBank: jest.fn(async () => ({ connectionId: 'conn-1', added: 3, status: 'active' })),
        syncUser: jest.fn(async () => ({ added: 2, connections: 1 })),
        syncAll: jest.fn(async () => ({ added: 5, connections: 2 })),
        unlinkBank: jest.fn(async () => undefined),
    }
    const e: HandlerEnv = {
        cronSecret: 'cron-secret',
        getUser: jest.fn(async (token: string) => token.includes('.') ? { id: 'alice', hasTwoFactor: true } : null),
        makeDeps: () => ({}) as any,
        service,
        ...over,
    }
    return { e, service }
}

const json = async (res: Response) => ({ status: res.status, body: await res.json() })

describe('bank server function', () => {
    it('answers browser preflight requests', async () => {
        const res = await handleBankRequest(request(null, {}, 'OPTIONS'), env().e)
        expect(res.status).toBe(200)
        expect(res.headers.get('access-control-allow-origin')).toBe('*')
        expect(res.headers.get('access-control-allow-headers')).toMatch(/authorization/i)
    })

    it('requires being signed in', async () => {
        expect(await json(await handleBankRequest(request({ action: 'sync' }), env().e)))
            .toEqual({ status: 401, body: { error: 'Please sign in again.' } })
    })

    it('requires two-factor sign-in to be set up', async () => {
        const { e } = env({ getUser: jest.fn(async () => ({ id: 'alice', hasTwoFactor: false })) })
        expect(await json(await handleBankRequest(request({ action: 'sync' }, ALICE_2FA), e)))
            .toEqual({ status: 403, body: { error: 'Turn on two-factor sign-in in Settings before linking a bank.', code: 'two_factor_required' } })
    })

    it('requires the two-factor code to have been entered this session', async () => {
        const res = await json(await handleBankRequest(request({ action: 'sync' }, ALICE_NO_2FA), env().e))
        expect(res).toEqual({ status: 403, body: { error: 'Enter your two-factor code to continue.', code: 'two_factor_needed' } })
    })

    it('links a bank for the signed-in user only', async () => {
        const { e, service } = env()
        const res = await json(await handleBankRequest(request({
            action: 'link', accessToken: 'token_abc', enrollmentId: 'enr_1', institutionName: 'Chase', syncFrom: '2026-09-01', userId: 'mallory',
        }, ALICE_2FA), e))
        expect(res).toEqual({ status: 200, body: { connectionId: 'conn-1', added: 3, status: 'active' } })
        expect(service.linkBank).toHaveBeenCalledWith(expect.anything(), {
            userId: 'alice', accessToken: 'token_abc', enrollmentId: 'enr_1', institutionName: 'Chase', syncFrom: '2026-09-01',
        })
    })

    it('validates what the app sends when linking', async () => {
        const res = await json(await handleBankRequest(request({ action: 'link', accessToken: '', enrollmentId: 'enr', syncFrom: 'soon' }, ALICE_2FA), env().e))
        expect(res.status).toBe(400)
    })

    it('syncs and unlinks for the signed-in user', async () => {
        const { e, service } = env()
        expect((await json(await handleBankRequest(request({ action: 'sync' }, ALICE_2FA), e))).body).toEqual({ added: 2, connections: 1 })
        expect(service.syncUser).toHaveBeenCalledWith(expect.anything(), 'alice')
        await handleBankRequest(request({ action: 'unlink', connectionId: 'conn-9' }, ALICE_2FA), e)
        expect(service.unlinkBank).toHaveBeenCalledWith(expect.anything(), { userId: 'alice', connectionId: 'conn-9' })
    })

    it('runs the daily sync for everyone only with the schedule\'s secret', async () => {
        const { e, service } = env()
        expect((await handleBankRequest(request({ action: 'sync-all' }, { 'x-cron-secret': 'wrong' }), e)).status).toBe(401)
        expect((await handleBankRequest(request({ action: 'sync-all' }, ALICE_2FA), e)).status).toBe(401)
        expect(service.syncAll).not.toHaveBeenCalled()
        expect((await json(await handleBankRequest(request({ action: 'sync-all' }, { 'x-cron-secret': 'cron-secret' }), e))).body)
            .toEqual({ added: 5, connections: 2 })
    })

    it('refuses the daily sync when no schedule secret is configured', async () => {
        const { e } = env({ cronSecret: undefined })
        expect((await handleBankRequest(request({ action: 'sync-all' }, { 'x-cron-secret': '' }), e)).status).toBe(401)
    })

    it('rejects unknown actions', async () => {
        expect((await handleBankRequest(request({ action: 'transfer-money' }, ALICE_2FA), env().e)).status).toBe(400)
    })

    it('reports failures without leaking the bank token', async () => {
        const { e, service } = env()
        service.linkBank.mockRejectedValueOnce(new Error('Teller said no to token_abc'))
        const res = await json(await handleBankRequest(request({
            action: 'link', accessToken: 'token_abc', enrollmentId: 'enr_1', institutionName: 'Chase', syncFrom: '2026-09-01',
        }, ALICE_2FA), e))
        expect(res.status).toBe(502)
        expect(JSON.stringify(res.body)).not.toContain('token_abc')
    })
})
