// Runs the real SQL files in supabase/sql/subscriptions against an in-memory Postgres
// that mimics Supabase's auth schema, roles and row-level security.
// Uses Node's built-in test runner (run with `npm run test:db`, or `npm test` for everything).
import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SQL_DIR = path.join(__dirname, '..', 'subscriptions')
const sql = (file) => fs.readFileSync(path.join(SQL_DIR, file), 'utf8')

const ALICE = '00000000-0000-0000-0000-00000000000a'
const BOB = '00000000-0000-0000-0000-00000000000b'

let db

/** A fresh database with Supabase-like auth, roles and the app's transactions table. */
async function freshDb() {
    const d = await PGlite.create()
    await d.exec(`
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
          recurring text default 'none', recurring_end date, created_at timestamptz default now());
        alter table public.transactions enable row level security;
        create policy own on public.transactions for all to authenticated
          using (user_id = auth.uid()) with check (user_id = auth.uid());

        grant usage on schema public to anon, authenticated;
        grant all on all tables in schema public to authenticated;
        alter default privileges in schema public grant all on tables to authenticated;
        -- Supabase lets anon execute new functions by default; the setup must revoke it
        alter default privileges in schema public grant execute on functions to anon;
    `)
    return d
}

/** Run the rest of the test as a signed-in user, as the anon key, or as the scheduled job (no user). */
async function as(who) {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`)
    if (who === 'anon') await db.exec('set role anon')
    else if (who !== 'job') await db.exec(`select set_config('request.jwt.claim.sub', '${who}', false); set role authenticated;`)
}

const rows = async (q, params = []) => (await db.query(q, params)).rows
const one = async (q, params = []) => (await rows(q, params))[0]
const generate = async (today) => (await one(`select generate_subscription_transactions($1::date) as n`, [today])).n
const charges = async (name) =>
    (await rows(`select date::text d from transactions where name = $1 and subscription_id is not null order by date`, [name])).map(r => r.d)

async function addSubscription(fields) {
    const cols = Object.keys(fields)
    const vals = cols.map((_, i) => `$${i + 1}`)
    return one(`insert into subscriptions (${cols.join(',')}) values (${vals.join(',')}) returning id`, Object.values(fields))
}

describe('01_setup.sql', () => {
    beforeEach(async () => {
        db = await freshDb()
        await db.exec(sql('01_setup.sql'))
    })

    it('can be run more than once', async () => {
        await db.exec(sql('01_setup.sql'))
    })

    it('fills in every missed charge once, on its real date', async () => {
        await as(ALICE)
        await addSubscription({ name: 'Netflix', amount: 15.99, frequency: 'monthly', start_date: '2026-06-15' })
        assert.equal(await generate('2026-10-05'), 4) // Oct 15 isn't due yet
        assert.deepEqual(await charges('Netflix'), ['2026-06-15', '2026-07-15', '2026-08-15', '2026-09-15'])
    })

    it('does nothing when run again', async () => {
        await as(ALICE)
        await addSubscription({ name: 'Netflix', amount: 15.99, frequency: 'monthly', start_date: '2026-06-15' })
        await generate('2026-10-05')
        assert.equal(await generate('2026-10-05'), 0)
    })

    it('keeps month-end charges on the last day without drifting', async () => {
        await as(ALICE)
        await addSubscription({ name: 'Gym', amount: 30, frequency: 'monthly', start_date: '2026-01-31' })
        await generate('2026-05-01')
        assert.deepEqual(await charges('Gym'), ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'])
    })

    it('stops at the end date and skips paused subscriptions', async () => {
        await as(ALICE)
        await addSubscription({ name: 'Trial', amount: 5, frequency: 'weekly', start_date: '2026-09-01', end_date: '2026-09-15' })
        await addSubscription({ name: 'Paused', amount: 5, frequency: 'weekly', start_date: '2026-09-01', status: 'paused' })
        await generate('2026-10-05')
        assert.deepEqual(await charges('Trial'), ['2026-09-01', '2026-09-08', '2026-09-15'])
        assert.deepEqual(await charges('Paused'), [])
    })

    it('does not bring back a charge you deleted', async () => {
        await as(ALICE)
        await addSubscription({ name: 'Netflix', amount: 15.99, frequency: 'monthly', start_date: '2026-08-15' })
        await generate('2026-10-05')
        await db.exec(`delete from transactions where name = 'Netflix' and date = '2026-09-15'`)
        assert.equal(await generate('2026-10-05'), 0)
        assert.deepEqual(await charges('Netflix'), ['2026-08-15'])
    })

    it('ignores a date in the future', async () => {
        await as(ALICE)
        await addSubscription({ name: 'Netflix', amount: 15.99, frequency: 'monthly', start_date: '2026-01-01' })
        const today = (await one(`select current_date::text d`)).d
        await generate('2099-01-01')
        const latest = (await charges('Netflix')).pop()
        assert.equal(latest <= today, true)
    })

    it('refuses a second charge for the same subscription and date', async () => {
        await as(ALICE)
        const { id } = await addSubscription({ name: 'Netflix', amount: 15.99, frequency: 'monthly', start_date: '2026-09-15' })
        await generate('2026-10-05')
        await assert.rejects(db.query(
            `insert into transactions (user_id, type, amount, name, date, subscription_id) values ($1, 'expense', 15.99, 'Netflix', '2026-09-15', $2)`,
            [ALICE, id],
        ), /duplicate key/)
    })

    it('keeps past charges when a subscription is deleted', async () => {
        await as(ALICE)
        const { id } = await addSubscription({ name: 'Netflix', amount: 15.99, frequency: 'monthly', start_date: '2026-09-15' })
        await generate('2026-10-05')
        await db.query(`delete from subscriptions where id = $1`, [id])
        assert.deepEqual(await one(`select count(*)::int c from transactions where name = 'Netflix'`), { c: 1 })
    })

    describe('security', () => {
        it('users only see and generate their own subscriptions', async () => {
            await as(ALICE)
            await addSubscription({ name: 'Alice sub', amount: 1, frequency: 'weekly', start_date: '2026-10-01' })
            await as(BOB)
            await addSubscription({ name: 'Bob sub', amount: 1, frequency: 'weekly', start_date: '2026-10-01' })
            assert.deepEqual((await rows(`select name from subscriptions`)).map(r => r.name), ['Bob sub'])
            assert.equal(await generate('2026-10-05'), 1)
            await as(ALICE)
            assert.deepEqual(await charges('Bob sub'), [])
        })

        it('users cannot create subscriptions for someone else', async () => {
            await as(ALICE)
            await assert.rejects(addSubscription({ user_id: BOB, name: 'X', amount: 1, frequency: 'weekly', start_date: '2026-10-01' }), /row-level security/)
        })

        it('the public anon key cannot run the generator', async () => {
            await as('anon')
            await assert.rejects(generate('2026-10-05'), /permission denied/)
        })

        it('the scheduled job generates for everyone', async () => {
            await as(ALICE)
            await addSubscription({ name: 'A', amount: 1, frequency: 'weekly', start_date: '2026-10-01' })
            await as(BOB)
            await addSubscription({ name: 'B', amount: 1, frequency: 'weekly', start_date: '2026-10-01' })
            await as('job')
            assert.equal(await generate('2026-10-05'), 2)
        })
    })

    it('rejects invalid subscriptions', async () => {
        await as(ALICE)
        await assert.rejects(addSubscription({ name: ' ', amount: 1, frequency: 'weekly', start_date: '2026-10-01' }), /check/)
        await assert.rejects(addSubscription({ name: 'X', amount: 0, frequency: 'weekly', start_date: '2026-10-01' }), /check/)
        await assert.rejects(addSubscription({ name: 'X', amount: 1, frequency: 'daily', start_date: '2026-10-01' }), /check/)
        await assert.rejects(addSubscription({ name: 'X', amount: 1, frequency: 'weekly', start_date: '2026-10-01', end_date: '2026-09-01' }), /check/)
    })
})

describe('preview and conversion of old recurring transactions', () => {
    beforeEach(async () => {
        db = await freshDb()
        // What the old copying bug left behind: multiplied copies on the same date
        await db.exec(`
            insert into transactions (user_id, type, amount, name, category_label, date, recurring, recurring_end, created_at) values
              ('${ALICE}', 'expense', 15.99, 'Netflix', 'Entertainment', '2026-06-15', 'monthly', null, now() - interval '30 days'),
              ('${ALICE}', 'expense', 15.99, 'Netflix', 'Entertainment', '2026-06-15', 'monthly', null, now() - interval '20 days'),
              ('${ALICE}', 'expense', 15.99, 'Netflix', 'Entertainment', '2026-06-15', 'monthly', null, now() - interval '10 days'),
              ('${ALICE}', 'income', 2000, 'Paycheck', 'Salary', '2026-09-12', 'biweekly', null, now()),
              ('${ALICE}', 'income', 2000, 'Paycheck', 'Salary', '2026-09-26', 'biweekly', null, now()),
              ('${ALICE}', 'expense', 50, 'Old gym', null, '2026-03-01', 'monthly', '2026-02-01', now()),
              ('${ALICE}', 'expense', 42.10, 'Groceries', 'Food', '2026-09-20', 'none', null, now()),
              ('${BOB}', 'expense', 9.99, 'Spotify', null, '2026-08-03', 'monthly', null, now()),
              ('${BOB}', 'expense', 9.99, 'Spotify', null, '2026-08-03', 'monthly', null, now());
        `)
        await db.exec(sql('01_setup.sql'))
    })

    it('step 2 previews one subscription per charge', async () => {
        const preview = await rows(sql('02_preview_subscriptions.sql'))
        assert.deepEqual(preview.map(r => [r.subscription_name, r.rows_now, r.copies_to_delete]), [
            ['Netflix', 3, 2], ['Old gym', 1, 0], ['Paycheck', 2, 0], ['Spotify', 2, 1],
        ])
    })

    it('step 3 lists exactly the extra copies, keeping the oldest', async () => {
        const toDelete = await rows(sql('03_preview_deletions.sql'))
        assert.deepEqual(toDelete.map(r => r.name).sort(), ['Netflix', 'Netflix', 'Spotify'])
        const oldestNetflix = await one(`select id from transactions where name = 'Netflix' order by created_at limit 1`)
        assert.ok(!toDelete.map(r => r.id).includes(oldestNetflix.id))
    })

    it('step 4 converts, and running it again changes nothing', async () => {
        assert.deepEqual(await one(sql('04_convert_old_recurring.sql')), {
            duplicate_copies_deleted: 3, subscriptions_created: 4, transactions_linked: 5,
        })
        assert.deepEqual(await one(sql('04_convert_old_recurring.sql')), {
            duplicate_copies_deleted: 0, subscriptions_created: 0, transactions_linked: 0,
        })
        const subs = await rows(`select name, frequency, start_date::text s, generated_through::text g, status from subscriptions order by name`)
        assert.deepEqual(subs, [
            { name: 'Netflix', frequency: 'monthly', s: '2026-06-15', g: '2026-06-15', status: 'active' },
            { name: 'Old gym', frequency: 'monthly', s: '2026-03-01', g: '2026-03-01', status: 'cancelled' },
            { name: 'Paycheck', frequency: 'biweekly', s: '2026-09-12', g: '2026-09-26', status: 'active' },
            { name: 'Spotify', frequency: 'monthly', s: '2026-08-03', g: '2026-08-03', status: 'active' },
        ])
        assert.deepEqual(await one(`select count(*)::int c from transactions where recurring <> 'none'`), { c: 0 })
        assert.deepEqual(await one(`select subscription_id from transactions where name = 'Groceries'`), { subscription_id: null })
    })

    it('step 4 finishes the job if an earlier attempt only deleted the copies', async () => {
        await db.exec(`delete from transactions t using (${sql('03_preview_deletions.sql').replace(/;\s*$/, '')}) d where t.id = d.id`)
        assert.deepEqual(await one(sql('04_convert_old_recurring.sql')), {
            duplicate_copies_deleted: 0, subscriptions_created: 4, transactions_linked: 5,
        })
    })

    it('after converting, catch-up continues from the last charge without duplicates', async () => {
        await db.query(sql('04_convert_old_recurring.sql'))
        await as('job')
        await generate('2026-10-05')
        assert.deepEqual(await charges('Netflix'), ['2026-06-15', '2026-07-15', '2026-08-15', '2026-09-15'])
        assert.deepEqual(await charges('Old gym'), ['2026-03-01'])
        assert.deepEqual(await one(`select count(*)::int c from (select 1 from transactions where subscription_id is not null group by subscription_id, date having count(*) > 1) x`), { c: 0 })
    })
})
