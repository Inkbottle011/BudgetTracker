// Linking, syncing and unlinking banks. Runs only on the server (service role); provider-neutral.
import { encryptToken, decryptToken } from './crypto.ts'
import { convertBankTransactions, SAME_PLACE_DAYS, MONEY_IN_TYPES, type PossibleDuplicate, type TransactionRow } from './convert.ts'
import { findTransferPairs, TRANSFER_DAYS, type TransferCandidate } from './transfers.ts'
import { isCardPayment } from '../entry.ts'
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

/** Starts a bank sign-in window session, for providers that need one (Plaid). */
export async function startLink(deps: BankDeps, userId: string): Promise<{ linkToken?: string }> {
    return deps.provider.createLinkSession ? deps.provider.createLinkSession(userId) : {}
}

export async function linkBank(deps: BankDeps, input: {
    userId: string
    institutionName: string | null
    syncFrom: string
    /** Plaid: the one-time token from its sign-in window, exchanged here for a lasting one */
    publicToken?: string
    /** Teller: the sign-in window gives the lasting token and enrollment id directly */
    accessToken?: string
    enrollmentId?: string
}) {
    let accessToken = input.accessToken ?? ''
    let enrollmentId = input.enrollmentId ?? ''
    if (input.publicToken) {
        if (!deps.provider.exchangeLinkResult) throw new Error('This bank provider does not use a one-time token')
        ;({ accessToken, enrollmentId } = await deps.provider.exchangeLinkResult({ publicToken: input.publicToken }))
    }
    if (!accessToken || !enrollmentId) throw new Error('Missing bank details. Please try linking again.')

    // Proves the token works before anything is stored
    const accounts = await deps.provider.listAccounts(accessToken)

    const { data: existing } = await deps.db.from('bank_connections').select('id, user_id')
        .eq('provider', deps.provider.name).eq('provider_enrollment_id', enrollmentId)
    if ((existing ?? []).some((c: any) => c.user_id !== input.userId)) throw new Error('This bank login is linked to another account')

    const { data: conn, error } = await deps.db.from('bank_connections').upsert({
        user_id: input.userId,
        provider: deps.provider.name,
        provider_enrollment_id: enrollmentId,
        institution_name: input.institutionName ?? accounts[0]?.institutionName ?? null,
        encrypted_token: await encryptToken(accessToken, deps.key),
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
        // The one-time transfer check re-reads everything from the start date, so card payments that
        // older versions dropped come back (as transfers) and can pair with the payment from checking
        const fullCheck = !conn.transfers_checked
        const since = fullCheck || lastSynced < conn.sync_from ? conn.sync_from : lastSynced

        const { data: accounts } = await deps.db.from('bank_accounts').select('*').eq('connection_id', conn.id)
        const { data: allAccounts } = await deps.db.from('bank_accounts').select('id, type').eq('user_id', conn.user_id)
        const hasLinkedCreditCard = (allAccounts ?? []).some((a: any) => a.type === 'credit')
        const accountType = new Map<string, string>((allAccounts ?? []).map((a: any) => [a.id, a.type]))

        const { data: history } = await deps.db.from('transactions').select('name, note, category_label, type')
            .eq('user_id', conn.user_id).not('category_label', 'is', null).neq('category_label', '')
            .order('date', { ascending: false }).limit(3000)
        // Yours (typed in or from a CSV), a few days either side since the bank's date can differ
        const { data: existing } = await deps.db.from('transactions').select('id, date, amount, name, note, type')
            .eq('user_id', conn.user_id).is('external_id', null).gte('date', daysBefore(since, SAME_PLACE_DAYS)).lte('date', today)
        // Bank transactions already saved or waiting for review, so re-checking never adds them twice
        const imported = await loadAll(() => deps.db.from('transactions').select('external_id')
            .eq('user_id', conn.user_id).eq('provider', conn.provider).not('external_id', 'is', null).gte('date', since).order('date'))
        const { data: waiting } = await deps.db.from('bank_possible_duplicates').select('external_id')
            .eq('user_id', conn.user_id).eq('provider', conn.provider)
        const alreadyImported = new Set<string>([...imported, ...(waiting ?? [])].map((r: any) => r.external_id))

        const rows: TransactionRow[] = []
        const moneyIn = new Set<string>()
        const reviews: PossibleDuplicate[] = []
        const skipped = { pending: 0, beforeStart: 0, duplicate: 0, cardPayment: 0, alreadyImported: 0 }
        for (const acc of (accounts ?? []).filter((a: any) => a.connection_id === conn.id)) {
            const txs = await deps.provider.listTransactions(token, acc.provider_account_id, since)
            await saveBalance(deps, token, acc)
            const r = convertBankTransactions(txs, { id: acc.id, type: acc.type, providerAccountId: acc.provider_account_id }, {
                userId: conn.user_id, provider: conn.provider, syncFrom: conn.sync_from,
                history: history ?? [], existing: existing ?? [], hasLinkedCreditCard, alreadyImported,
            })
            rows.push(...r.rows)
            reviews.push(...r.reviews)
            r.moneyIn.forEach(id => moneyIn.add(id))
            for (const k of Object.keys(skipped) as (keyof typeof skipped)[]) skipped[k] += r.skipped[k]
        }

        // Money moving between your own accounts is saved as 'transfer' so it isn't counted twice.
        // The first time (transfers_checked false) this also fixes transfers imported before.
        const transfers = await markTransfers(deps, conn, rows, moneyIn, accountType,
            daysBefore(fullCheck ? conn.sync_from : since, TRANSFER_DAYS), fullCheck)

        let added = 0
        if (rows.length) {
            const { data, error } = await deps.db.from('transactions')
                .upsert(rows, { onConflict: 'user_id,provider,external_id', ignoreDuplicates: true }).select('id')
            if (error) throw new Error(`Couldn't save transactions: ${error.message}`)
            added = (data ?? []).length
        }

        let toReview = 0
        if (reviews.length) {
            const { data, error } = await deps.db.from('bank_possible_duplicates').upsert(reviews.map(({ row, existing_transaction_id }) => ({
                user_id: row.user_id, provider: row.provider, external_id: row.external_id, bank_account_id: row.bank_account_id,
                date: row.date, amount: row.amount, type: row.type, name: row.name, category_label: row.category_label,
                existing_transaction_id,
            })), { onConflict: 'user_id,provider,external_id', ignoreDuplicates: true }).select('id')
            if (error) throw new Error(`Couldn't save possible duplicates: ${error.message}`)
            toReview = (data ?? []).length
        }

        await deps.db.from('bank_connections')
            .update({ status: 'active', last_error: null, last_synced_at: new Date().toISOString(), transfers_checked: true }).eq('id', conn.id)
        return { added, toReview, transfers, skipped, status: 'active' as const }
    } catch (e) {
        // Just linked and the bank's data is still loading: not a problem, try again later
        if (e instanceof ProviderError && e.kind === 'not_ready') {
            await deps.db.from('bank_connections').update({ status: 'active', last_error: null }).eq('id', conn.id)
            return { added: 0, toReview: 0, transfers: 0, skipped: null, status: 'pending' as const }
        }
        const status = e instanceof ProviderError && e.kind === 'needs_relink' ? 'needs_relink' : 'error'
        await deps.db.from('bank_connections').update({ status, last_error: safeMessage(e, token) }).eq('id', conn.id)
        return { added: 0, toReview: 0, transfers: 0, skipped: null, status }
    }
}

const KEEP_TYPES = new Set(['savings', 'investment'])

/** Reads every row of a query, a page at a time (Supabase returns at most 1000 rows per request). */
async function loadAll(query: () => any, pageSize = 1000) {
    const all: any[] = []
    for (let from = 0; ; from += pageSize) {
        const { data, error } = await query().range(from, from + pageSize - 1)
        if (error) throw new Error(error.message)
        all.push(...(data ?? []))
        if (!data || data.length < pageSize) return all
    }
}

/**
 * Pairs money leaving one of your linked accounts with the same amount arriving in another and
 * marks both 'transfer': new rows before they're saved, saved rows with an update. Saved rows are
 * only changed when paired with a new one, or during the one-time full check, so if you change a
 * transfer back to something else, it stays changed. Returns how many became transfers.
 */
async function markTransfers(deps: BankDeps, conn: any, rows: TransactionRow[], moneyIn: Set<string>,
    accountType: Map<string, string>, from: string, fullCheck: boolean) {
    const saved = await loadAll(() => deps.db.from('transactions').select('id, bank_account_id, date, amount, type, name')
        .eq('user_id', conn.user_id).not('provider', 'is', null).gte('date', from).order('date'))

    const candidates: TransferCandidate[] = []
    const savedById = new Map<string, any>()
    const toUpdate = new Set<string>()
    for (const t of saved) {
        const type = accountType.get(t.bank_account_id)
        if (!type) continue
        // A saved transfer can only be told apart by direction on a card: there it's a payment coming in
        if (t.type === 'transfer' && type !== 'credit') continue
        const isIn = t.type === 'transfer' || MONEY_IN_TYPES.has(t.type)
        savedById.set(t.id, t)
        candidates.push({ key: `saved:${t.id}`, accountId: t.bank_account_id, accountType: type, date: String(t.date).slice(0, 10),
            amount: Math.abs(Number(t.amount)), moneyIn: isIn, description: t.name ?? '' })
        // Card payments imported before they were recognized
        if (fullCheck && type === 'credit' && isIn && t.type !== 'transfer' && isCardPayment(t.name)) toUpdate.add(t.id)
    }
    const newByKey = new Map<string, TransactionRow>()
    for (const r of rows) {
        newByKey.set(`new:${r.external_id}`, r)
        candidates.push({ key: `new:${r.external_id}`, accountId: r.bank_account_id, accountType: accountType.get(r.bank_account_id) ?? 'depository',
            date: r.date, amount: r.amount, moneyIn: moneyIn.has(r.external_id), description: r.name })
    }

    for (const pair of findTransferPairs(candidates)) {
        const involvesNew = pair.some(k => k.startsWith('new:'))
        if (!involvesNew && !fullCheck) continue
        for (const key of pair) {
            const row = newByKey.get(key)
            const type = row ? row.type : savedById.get(key.slice('saved:'.length))?.type
            // Money put into savings or investments still counts as saved; only its other side
            // (showing up as income in the savings account) is the transfer
            if (KEEP_TYPES.has(type) || type === 'transfer') continue
            if (row) { row.type = 'transfer'; row.category_label = '' }
            else toUpdate.add(key.slice('saved:'.length))
        }
    }

    const ids = [...toUpdate]
    for (let i = 0; i < ids.length; i += 200) {
        const { error } = await deps.db.from('transactions').update({ type: 'transfer', category_label: '' })
            .eq('user_id', conn.user_id).in('id', ids.slice(i, i + 200))
        if (error) throw new Error(`Couldn't mark transfers: ${error.message}`)
    }
    return rows.filter(r => r.type === 'transfer').length + ids.length
}

/** Saves an account's current balance. A balance problem never stops transactions from syncing. */
async function saveBalance(deps: BankDeps, token: string, acc: any) {
    if (!deps.provider.getBalance) return
    try {
        const b = await deps.provider.getBalance(token, acc.provider_account_id, acc.type)
        await deps.db.from('bank_accounts').update({
            balance_current: b.current, balance_available: b.available, balance_updated_at: new Date().toISOString(),
        }).eq('id', acc.id)
    } catch {
        // e.g. balances not enabled for this connection: keep the last known balance
    }
}

export async function syncUser(deps: BankDeps, userId: string) {
    const { data, error } = await deps.db.from('bank_connections').select('id, user_id').eq('user_id', userId)
    if (error) throw new Error(error.message)
    let added = 0, toReview = 0, connections = 0
    for (const c of (data ?? []).filter((c: any) => c.user_id === userId)) {
        const r = await syncConnection(deps, c.id)
        added += r.added
        toReview += r.toReview
        connections++
    }
    return { added, toReview, connections }
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
