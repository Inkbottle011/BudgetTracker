// Linking, syncing and unlinking banks. Runs only on the server (service role); provider-neutral.
import { encryptToken, decryptToken } from './crypto.ts'
import { convertBankTransactions } from './convert.ts'
import { BankProvider, ProviderError } from './types.ts'

export interface BankDeps {
    db: any                    // Supabase client with the service role
    provider: BankProvider
    key: string                // BANK_TOKEN_KEY
    today?: () => string       // YYYY-MM-DD, for tests
}

const RECHECK_DAYS = 7         // transactions can post a few days late, so look back this far each sync

function todayOf(deps: BankDeps) {
    return deps.today?.() ?? new Date().toISOString().slice(0, 10)
}

function daysBefore(date: string, days: number) {
    const d = new Date(`${date.slice(0, 10)}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() - days)
    return d.toISOString().slice(0, 10)
}

/** Error text that's safe to store and show: never contains the token. */
function safeMessage(e: unknown, token: string) {
    const msg = e instanceof Error ? e.message : String(e)
    return (token ? msg.split(token).join('[token]') : msg).slice(0, 300)
}

async function loadConnection(deps: BankDeps, connectionId: string, userId?: string) {
    let q = deps.db.from('bank_connections').select('*').eq('id', connectionId)
    if (userId) q = q.eq('user_id', userId)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    const conn = (data ?? []).find((c: any) => c.id === connectionId && (!userId || c.user_id === userId))
    if (!conn) throw new Error('Linked bank not found')
    return conn
}

export async function linkBank(deps: BankDeps, input: {
    userId: string; accessToken: string; enrollmentId: string; institutionName: string | null; syncFrom: string
}) {
    // Proves the token works before anything is stored
    const accounts = await deps.provider.listAccounts(input.accessToken)

    const { data: existing } = await deps.db.from('bank_connections').select('id, user_id')
        .eq('provider', deps.provider.name).eq('provider_enrollment_id', input.enrollmentId)
    if ((existing ?? []).some((c: any) => c.user_id !== input.userId)) throw new Error('This bank login is linked to another account')

    const { data: conn, error } = await deps.db.from('bank_connections').upsert({
        user_id: input.userId,
        provider: deps.provider.name,
        provider_enrollment_id: input.enrollmentId,
        institution_name: input.institutionName ?? accounts[0]?.institutionName ?? null,
        encrypted_token: await encryptToken(input.accessToken, deps.key),
        sync_from: input.syncFrom,
        status: 'active',
        last_error: null,
    }, { onConflict: 'provider,provider_enrollment_id' }).select('id').single()
    if (error || !conn) throw new Error(`Couldn't save the linked bank: ${error?.message ?? 'unknown error'}`)

    const { error: accError } = await deps.db.from('bank_accounts').upsert(accounts.map(a => ({
        connection_id: conn.id, user_id: input.userId, provider_account_id: a.providerAccountId,
        name: a.name, type: a.type, subtype: a.subtype, last_four: a.lastFour,
    })), { onConflict: 'connection_id,provider_account_id' }).select('id')
    if (accError) throw new Error(`Couldn't save the bank's accounts: ${accError.message}`)

    const sync = await syncConnection(deps, conn.id)
    return { connectionId: conn.id, ...sync }
}

export async function syncConnection(deps: BankDeps, connectionId: string) {
    const conn = await loadConnection(deps, connectionId)
    let token = ''
    try {
        token = await decryptToken(conn.encrypted_token, deps.key)
        const today = todayOf(deps)
        const lastSynced = conn.last_synced_at ? daysBefore(String(conn.last_synced_at), RECHECK_DAYS) : conn.sync_from
        const since = lastSynced > conn.sync_from ? lastSynced : conn.sync_from

        const { data: accounts } = await deps.db.from('bank_accounts').select('*').eq('connection_id', conn.id)
        const { data: allAccounts } = await deps.db.from('bank_accounts').select('type').eq('user_id', conn.user_id)
        const hasLinkedCreditCard = (allAccounts ?? []).some((a: any) => a.type === 'credit')

        const { data: history } = await deps.db.from('transactions').select('name, note, category_label, type')
            .eq('user_id', conn.user_id).not('category_label', 'is', null).neq('category_label', '')
            .order('date', { ascending: false }).limit(3000)
        const { data: existing } = await deps.db.from('transactions').select('date, amount, name, note')
            .eq('user_id', conn.user_id).is('external_id', null).gte('date', since).lte('date', today)

        const rows = []
        const skipped = { pending: 0, beforeStart: 0, duplicate: 0, cardPayment: 0 }
        for (const acc of (accounts ?? []).filter((a: any) => a.connection_id === conn.id)) {
            const txs = await deps.provider.listTransactions(token, acc.provider_account_id, since)
            const r = convertBankTransactions(txs, { id: acc.id, type: acc.type, providerAccountId: acc.provider_account_id }, {
                userId: conn.user_id, provider: conn.provider, syncFrom: conn.sync_from,
                history: history ?? [], existing: existing ?? [], hasLinkedCreditCard,
            })
            rows.push(...r.rows)
            for (const k of Object.keys(skipped) as (keyof typeof skipped)[]) skipped[k] += r.skipped[k]
        }

        let added = 0
        if (rows.length) {
            const { data, error } = await deps.db.from('transactions')
                .upsert(rows, { onConflict: 'user_id,provider,external_id', ignoreDuplicates: true }).select('id')
            if (error) throw new Error(`Couldn't save transactions: ${error.message}`)
            added = (data ?? []).length
        }

        await deps.db.from('bank_connections')
            .update({ status: 'active', last_error: null, last_synced_at: new Date().toISOString() }).eq('id', conn.id)
        return { added, skipped, status: 'active' as const }
    } catch (e) {
        const status = e instanceof ProviderError && e.kind === 'needs_relink' ? 'needs_relink' : 'error'
        await deps.db.from('bank_connections').update({ status, last_error: safeMessage(e, token) }).eq('id', conn.id)
        return { added: 0, skipped: null, status }
    }
}

export async function syncUser(deps: BankDeps, userId: string) {
    const { data, error } = await deps.db.from('bank_connections').select('id, user_id').eq('user_id', userId)
    if (error) throw new Error(error.message)
    let added = 0, connections = 0
    for (const c of (data ?? []).filter((c: any) => c.user_id === userId)) {
        const r = await syncConnection(deps, c.id)
        added += r.added
        connections++
    }
    return { added, connections }
}

/** For the daily schedule: every connection that still works. */
export async function syncAll(deps: BankDeps) {
    const { data, error } = await deps.db.from('bank_connections').select('id').neq('status', 'needs_relink')
    if (error) throw new Error(error.message)
    let added = 0
    for (const c of data ?? []) added += (await syncConnection(deps, c.id)).added
    return { added, connections: (data ?? []).length }
}

export async function unlinkBank(deps: BankDeps, input: { userId: string; connectionId: string }) {
    const conn = await loadConnection(deps, input.connectionId, input.userId)
    const token = await decryptToken(conn.encrypted_token, deps.key)
    try {
        await deps.provider.disconnect(token)
    } catch (e) {
        // Already revoked at the provider: fine, just remove our copy
        if (!(e instanceof ProviderError && e.kind === 'needs_relink')) throw new Error(safeMessage(e, token))
    }
    const { error } = await deps.db.from('bank_connections').delete().eq('id', conn.id).eq('user_id', input.userId)
    if (error) throw new Error(`Couldn't remove the linked bank: ${error.message}`)
}
