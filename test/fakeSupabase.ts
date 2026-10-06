/**
 * A stand-in for the Supabase client in screen tests.
 *
 *   jest.mock('../../lib/supabase', () => require('../../test/fakeSupabase').module)
 *   import { fake } from '../../test/fakeSupabase'
 *   fake.table('transactions', { data: [...] })     // what queries on a table return
 *   fake.calls('transactions')                     // what the screen asked for
 *
 * Every query method (select, eq, order, insert, ...) is recorded and returns the same builder,
 * and awaiting the builder gives the table's configured result.
 */
type Result = { data?: any; error?: any; count?: number }
type Responder = Result | ((call: QueryCall) => Result)

export interface QueryCall { table: string; ops: { method: string; args: any[] }[] }

const tables = new Map<string, Responder>()
const queryLog: QueryCall[] = []

function builder(table: string) {
    const call: QueryCall = { table, ops: [] }
    queryLog.push(call)
    const respond = () => {
        const r = tables.get(table) ?? { data: [], error: null }
        return Promise.resolve(typeof r === 'function' ? r(call) : { data: null, error: null, ...r })
    }
    const b: any = new Proxy({}, {
        get(_t, prop: string) {
            if (prop === 'then') return (res: any, rej: any) => respond().then(res, rej)
            return (...args: any[]) => { call.ops.push({ method: prop, args }); return b }
        },
    })
    return b
}

export const auth = {
    getSession: jest.fn(async () => ({ data: { session: { user: { id: 'user-1', email: 'me@example.com' } } } })),
    signInWithPassword: jest.fn(async () => ({ data: {}, error: null })),
    signUp: jest.fn(async () => ({ data: {}, error: null })),
    signOut: jest.fn(async () => ({ error: null })),
    resetPasswordForEmail: jest.fn(async () => ({ data: {}, error: null })),
    updateUser: jest.fn(async () => ({ data: {}, error: null })),
    exchangeCodeForSession: jest.fn(async () => ({ data: {}, error: null })),
    onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    mfa: {
        listFactors: jest.fn(async () => ({ data: { all: [], totp: [] }, error: null })),
        enroll: jest.fn(async () => ({
            data: { id: 'factor-1', type: 'totp', totp: { qr_code: 'data:image/svg+xml;utf-8,<svg/>', secret: 'JBSWY3DPEHPK3PXP', uri: 'otpauth://totp/x' } },
            error: null,
        })),
        challengeAndVerify: jest.fn(async () => ({ data: {}, error: null })),
        unenroll: jest.fn(async () => ({ data: {}, error: null })),
        getAuthenticatorAssuranceLevel: jest.fn(async () => ({ data: { currentLevel: 'aal1', nextLevel: 'aal1' }, error: null })),
    },
}

export const functions = {
    invoke: jest.fn(async () => ({ data: {}, error: null })),
}

export const supabase = {
    from: jest.fn((table: string) => builder(table)),
    rpc: jest.fn(async () => ({ data: 0, error: null })),
    auth,
    functions,
}

export const fake = {
    table(name: string, result: Responder) { tables.set(name, result) },
    /** Queries made against a table, in order. */
    calls(name: string) { return queryLog.filter(c => c.table === name) },
    /** The arguments of the first `method` call made on a table (e.g. what was inserted). */
    arg(name: string, method: string) {
        for (const c of queryLog) if (c.table === name) for (const op of c.ops) if (op.method === method) return op.args[0]
        return undefined
    },
    reset() {
        tables.clear()
        queryLog.length = 0
        jest.clearAllMocks()
    },
}

export const module = { supabase }
