// Applies the database setup files to Supabase. Run automatically by .github/workflows/deploy-backend.yml
// when changes are merged into master, so you never have to paste SQL into the SQL Editor.
//
// Each file is applied once and fingerprinted (sha256) in public.app_setup_runs; a file runs again
// only if it changed. Every file listed here is safe to run more than once, so the first run on a
// database where they were already run by hand changes nothing.
//
// By hand:  SUPABASE_DB_URL="postgresql://..." node scripts/apply-database-setup.mjs
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const SQL_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'sql')

/**
 * In the order they must run. Left out on purpose: the subscription previews and one-time
 * conversion (02-04), and bank/02_daily_sync.sql, which holds your cron secret.
 */
export const SETUP_FILES = [
    'subscriptions/01_setup.sql',
    'reimbursements/01_setup.sql',
    'bank/01_setup.sql',
    'merchants/01_setup.sql',
]

export function readSetupFiles() {
    return SETUP_FILES.map(name => ({ name, sql: fs.readFileSync(path.join(SQL_ROOT, name), 'utf8') }))
}

const fingerprint = text => crypto.createHash('sha256').update(text).digest('hex')

/**
 * db: { exec(sql) for several statements, query(sql, params) -> rows }.
 * Applies new or changed files in order; each in its own transaction. Stops at the first failure.
 */
export async function applySetup(db, files, log = console.log) {
    await db.exec(`
        create table if not exists public.app_setup_runs (
          name        text primary key,
          checksum    text not null,
          applied_at  timestamptz not null default now()
        );
        revoke all on public.app_setup_runs from public;
        do $$ begin
          if exists (select 1 from pg_roles where rolname = 'anon') then
            execute 'revoke all on public.app_setup_runs from anon, authenticated';
          end if;
        end $$;
        alter table public.app_setup_runs enable row level security;
    `)
    const done = new Map((await db.query(`select name, checksum from public.app_setup_runs`)).map(r => [r.name, r.checksum]))

    const applied = []
    for (const file of files) {
        const sum = fingerprint(file.sql)
        if (done.get(file.name) === sum) { log(`= ${file.name} (up to date)`); continue }
        log(`> ${file.name}`)
        await db.exec('begin')
        try {
            await db.exec(file.sql)
            await db.query(
                `insert into public.app_setup_runs (name, checksum) values ($1, $2)
                 on conflict (name) do update set checksum = excluded.checksum, applied_at = now()`, [file.name, sum])
            await db.exec('commit')
        } catch (e) {
            await db.exec('rollback')
            throw new Error(`${file.name} failed, nothing from it was applied: ${e?.message ?? e}`)
        }
        applied.push(file.name)
    }
    log(applied.length ? `Applied ${applied.length} file(s).` : 'Database already up to date.')
    return { applied }
}

// Run directly: connect with SUPABASE_DB_URL and apply
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const url = process.env.SUPABASE_DB_URL
    if (!url) {
        console.error('Missing SUPABASE_DB_URL: the database connection string (Supabase -> Connect -> Session pooler).')
        process.exit(1)
    }
    const { default: pg } = await import('pg')
    const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
    await client.connect()
    try {
        await applySetup({ exec: s => client.query(s), query: async (s, p) => (await client.query(s, p)).rows }, readSetupFiles())
    } catch (e) {
        console.error(e.message)
        process.exitCode = 1
    } finally {
        await client.end()
    }
}
