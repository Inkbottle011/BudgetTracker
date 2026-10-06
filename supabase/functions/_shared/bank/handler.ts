// HTTP handling for the "bank" server function: who may do what, and safe responses.
// Kept free of Supabase/Deno specifics so it can be tested; index.ts wires in the real pieces.
import * as realService from './service.ts'
import type { BankDeps } from './service.ts'

export interface HandlerEnv {
    /** Shared secret the daily schedule sends; the sync-all action is refused without it. */
    cronSecret: string | undefined
    /** Checks a session token with Supabase Auth; null if it isn't valid. */
    getUser: (jwt: string) => Promise<{ id: string; hasTwoFactor: boolean } | null>
    makeDeps: () => BankDeps
    service?: Pick<typeof realService, 'linkBank' | 'syncUser' | 'syncAll' | 'unlinkBank'>
}

const CORS = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
    'access-control-allow-methods': 'POST, OPTIONS',
}

function reply(status: number, body: unknown) {
    return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } })
}

/** Reads the assurance level ("aal2" = two-factor code entered) from a token Supabase already validated. */
function aalOf(jwt: string): string | undefined {
    try {
        const payload = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
        return JSON.parse(atob(payload + '='.repeat((4 - (payload.length % 4)) % 4))).aal
    } catch {
        return undefined
    }
}

const isDate = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
const isText = (s: unknown) => typeof s === 'string' && s.trim().length > 0

export async function handleBankRequest(req: Request, env: HandlerEnv): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: CORS })
    if (req.method !== 'POST') return reply(405, { error: 'Use POST.' })

    const service = env.service ?? realService
    let body: any
    try { body = await req.json() } catch { return reply(400, { error: 'Send a JSON body.' }) }
    const action = body?.action
    const secretsToHide: string[] = typeof body?.accessToken === 'string' && body.accessToken ? [body.accessToken] : []

    const fail = (e: unknown) => {
        let msg = e instanceof Error ? e.message : String(e)
        for (const s of secretsToHide) msg = msg.split(s).join('[token]')
        return reply(502, { error: msg.slice(0, 300) })
    }

    // The daily schedule: no user, but must know the shared secret
    if (action === 'sync-all') {
        const given = req.headers.get('x-cron-secret') ?? ''
        if (!env.cronSecret || given !== env.cronSecret) return reply(401, { error: 'Not allowed.' })
        try { return reply(200, await service.syncAll(env.makeDeps())) } catch (e) { return fail(e) }
    }

    // Everything else acts for the signed-in user, who must use two-factor sign-in
    const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
    const user = jwt ? await env.getUser(jwt) : null
    if (!user) return reply(401, { error: 'Please sign in again.' })
    if (!user.hasTwoFactor) {
        return reply(403, { error: 'Turn on two-factor sign-in in Settings before linking a bank.', code: 'two_factor_required' })
    }
    if (aalOf(jwt) !== 'aal2') return reply(403, { error: 'Enter your two-factor code to continue.', code: 'two_factor_needed' })

    try {
        switch (action) {
            case 'link': {
                if (!isText(body.accessToken) || !isText(body.enrollmentId) || !isDate(body.syncFrom)) {
                    return reply(400, { error: 'Missing bank details. Please try linking again.' })
                }
                return reply(200, await service.linkBank(env.makeDeps(), {
                    userId: user.id,   // always the signed-in user, never what the request claims
                    accessToken: body.accessToken,
                    enrollmentId: body.enrollmentId,
                    institutionName: isText(body.institutionName) ? body.institutionName : null,
                    syncFrom: body.syncFrom,
                }))
            }
            case 'sync':
                return reply(200, await service.syncUser(env.makeDeps(), user.id))
            case 'unlink':
                if (!isText(body.connectionId)) return reply(400, { error: 'Which bank should be unlinked?' })
                await service.unlinkBank(env.makeDeps(), { userId: user.id, connectionId: body.connectionId })
                return reply(200, { ok: true })
            default:
                return reply(400, { error: 'Unknown action.' })
        }
    } catch (e) {
        return fail(e)
    }
}
