// "bank" server function: link, sync and unlink banks, plus the daily sync.
// Deploy:  supabase functions deploy bank
// Secrets (Supabase dashboard -> Edge Functions -> Secrets):
//   BANK_TOKEN_KEY   32 random bytes, base64 (openssl rand -base64 32). Encrypts stored bank tokens.
//   TELLER_ENV       sandbox | development | production
//   TELLER_CERT      contents of certificate.pem from Teller (not needed in sandbox)
//   TELLER_KEY       contents of private_key.pem from Teller (not needed in sandbox)
//   CRON_SECRET      any long random string; the daily schedule sends it
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { handleBankRequest } from '../_shared/bank/handler.ts'
import { createTellerProvider } from '../_shared/bank/teller.ts'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
})

// Teller requires a client certificate (mTLS) outside sandbox
const tellerEnv = Deno.env.get('TELLER_ENV') ?? 'sandbox'
let tellerClient: Deno.HttpClient | undefined
if (tellerEnv !== 'sandbox') {
    const cert = Deno.env.get('TELLER_CERT')
    const key = Deno.env.get('TELLER_KEY')
    if (!cert || !key) console.error('TELLER_CERT and TELLER_KEY are required outside sandbox')
    // deno-lint-ignore no-explicit-any
    else tellerClient = Deno.createHttpClient({ cert, key } as any)
}

const provider = createTellerProvider({
    // deno-lint-ignore no-explicit-any
    fetch: (url: string, init?: any) => fetch(url, { ...init, ...(tellerClient ? { client: tellerClient } : {}) }),
})

Deno.serve(req => handleBankRequest(req, {
    cronSecret: Deno.env.get('CRON_SECRET'),
    getUser: async (jwt: string) => {
        const { data, error } = await admin.auth.getUser(jwt)
        if (error || !data.user) return null
        // deno-lint-ignore no-explicit-any
        const hasTwoFactor = (data.user.factors ?? []).some((f: any) => f.status === 'verified')
        return { id: data.user.id, hasTwoFactor }
    },
    makeDeps: () => {
        const key = Deno.env.get('BANK_TOKEN_KEY')
        if (!key) throw new Error('The bank function is missing BANK_TOKEN_KEY. See the setup guide.')
        return { db: admin, provider, key }
    },
}))
