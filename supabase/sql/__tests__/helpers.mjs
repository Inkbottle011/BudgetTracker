// Shared setup for database tests: an in-memory Postgres that behaves like a Supabase project.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'

const SQL_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

export const ALICE = '00000000-0000-0000-0000-00000000000a'
export const BOB = '00000000-0000-0000-0000-00000000000b'

/** Reads a setup file, e.g. sql('subscriptions/01_setup.sql'). */
export const sql = (file) => fs.readFileSync(path.join(SQL_ROOT, file), 'utf8')

/**
 * A fresh database with Supabase-like auth, roles and the app's transactions table.
 * `typeCheck`: give transactions a check constraint on `type`, as a hand-made table might have.
 */
export async function freshDb({ typeCheck = false } = {}) {
    const db = await PGlite.create()
    await db.exec(`
        create role anon; create role authenticated; create role service_role;
        create schema auth;
        create table auth.users (id uuid primary key);
        create function auth.uid() returns uuid language sql stable
          as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
        grant usage on schema auth to anon, authenticated;
        grant execute on function auth.uid() to anon, authenticated;
        insert into auth.users values ('${ALICE}'), ('${BOB}');

        create table public.transactions (
          id uuid primary key default gen_random_uuid(),
          user_id uuid references auth.users(id), type text, category_id uuid, amount numeric,
          name text, note text, category_label text, date date,
          recurring text default 'none', recurring_end date, created_at timestamptz default now()
          ${typeCheck ? `, constraint transactions_type_check check (type in ('income', 'expense', 'savings', 'investment'))` : ''});
        alter table public.transactions enable row level security;
        create policy own on public.transactions for all to authenticated
          using (user_id = auth.uid()) with check (user_id = auth.uid());

        grant usage on schema public to anon, authenticated;
        -- Like newer Supabase projects: existing tables are granted, but NEW tables are not
        -- reachable by signed-in users until the setup SQL grants access explicitly
        grant all on all tables in schema public to authenticated;
        -- Supabase lets anon execute new functions by default; the setup must revoke it
        alter default privileges in schema public grant execute on functions to anon;
    `)

    const rows = async (q, params = []) => (await db.query(q, params)).rows
    return {
        db,
        rows,
        one: async (q, params = []) => (await rows(q, params))[0],
        /** Run what follows as a signed-in user, as the public anon key, or as a server job (no user). */
        as: async (who) => {
            await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`)
            if (who === 'anon') await db.exec('set role anon')
            else if (who !== 'job') await db.exec(`select set_config('request.jwt.claim.sub', '${who}', false); set role authenticated;`)
        },
        /** Insert a row from an object and return the new id. */
        insert: async (table, fields) => {
            const cols = Object.keys(fields)
            const vals = cols.map((_, i) => `$${i + 1}`)
            return (await rows(`insert into ${table} (${cols.join(',')}) values (${vals.join(',')}) returning id`, Object.values(fields)))[0].id
        },
    }
}
