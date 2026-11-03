// "bank" server function: link, sync and unlink banks, plus the daily sync.
// Deploy:  supabase functions deploy bank
//
// Secrets (Supabase dashboard -> Edge Functions -> Secrets):
//   BANK_TOKEN_KEY   32 random bytes, base64 (openssl rand -base64 32). Encrypts stored bank tokens.
//   CRON_SECRET      any long random string; the daily schedule sends it
//   BANK_PROVIDER    plaid (default) or teller: the main provider. SimpleFIN is always available too.
//   For Plaid:  PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV (sandbox | production)
//               PLAID_USERS: emails (or user ids), comma-separated, who may link banks with Plaid. Plaid
//               charges per linked bank, so everyone else links with SimpleFIN (which they pay for themselves).
//               Banks already linked with Plaid keep syncing either way.
//   For Teller: TELLER_ENV (sandbox | development | production), TELLER_CERT, TELLER_KEY
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { handleBankRequest } from '../_shared/bank/handler.ts'
import { createPlaidProvider } from '../_shared/bank/plaid.ts'
import { createTellerProvider } from '../_shared/bank/teller.ts'
import { createSimplefinProvider } from '../_shared/bank/simplefin.ts'
import type { BankProvider } from '../_shared/bank/types.ts'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
})

function makeProvider(): BankProvider {
    const choice = Deno.env.get('BANK_PROVIDER') ?? 'plaid'

    if (choice === 'teller') {
        // Teller requires a client certificate (mTLS) outside sandbox
        const tellerEnv = Deno.env.get('TELLER_ENV') ?? 'sandbox'
        let client: Deno.HttpClient | undefined
        if (tellerEnv !== 'sandbox') {
            const cert = Deno.env.get('TELLER_CERT'), key = Deno.env.get('TELLER_KEY')
            if (!cert || !key) throw new Error('TELLER_CERT and TELLER_KEY are required outside sandbox. See the setup guide.')
            // deno-lint-ignore no-explicit-any
            client = Deno.createHttpClient({ cert, key } as any)
        }
        // deno-lint-ignore no-explicit-any
        return createTellerProvider({ fetch: (url: string, init?: any) => fetch(url, { ...init, ...(client ? { client } : {}) }) })
    }

    const clientId = Deno.env.get('PLAID_CLIENT_ID'), secret = Deno.env.get('PLAID_SECRET')
    if (!clientId || !secret) throw new Error('The bank function is missing PLAID_CLIENT_ID or PLAID_SECRET. See the setup guide.')
    const env = Deno.env.get('PLAID_ENV') === 'production' ? 'production' : 'sandbox'
    return createPlaidProvider({ fetch, clientId, secret, env })
}

const MAIN = Deno.env.get('BANK_PROVIDER') ?? 'plaid'
const PLAID_USERS = (Deno.env.get('PLAID_USERS') ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)

Deno.serve(req => handleBankRequest(req, {
    cronSecret: Deno.env.get('CRON_SECRET'),
    getUser: async (jwt: string) => {
        const { data, error } = await admin.auth.getUser(jwt)
        if (error || !data.user) return null
        // deno-lint-ignore no-explicit-any
        const hasTwoFactor = (data.user.factors ?? []).some((f: any) => f.status === 'verified')
        return { id: data.user.id, hasTwoFactor, email: data.user.email ?? null }
    },
    mainProvider: MAIN,
    // Plaid only for the people listed in PLAID_USERS (Teller's free plan is open to everyone)
    canUseMain: user => MAIN !== 'plaid' || PLAID_USERS.includes(user.id.toLowerCase()) || (!!user.email && PLAID_USERS.includes(user.email.toLowerCase())),
    makeDeps: () => {
        const key = Deno.env.get('BANK_TOKEN_KEY')
        if (!key) throw new Error('The bank function is missing BANK_TOKEN_KEY. See the setup guide.')
        const simplefin = createSimplefinProvider({ fetch })
        // The main provider is only built when its keys are set, so SimpleFIN works without Plaid
        let main: BankProvider
        try { main = makeProvider() } catch (e) { if (MAIN === 'plaid' && !Deno.env.get('PLAID_CLIENT_ID')) main = simplefin; else throw e }
        return { db: admin, provider: main, providers: { [main.name]: main, simplefin }, key }
    },
}))
