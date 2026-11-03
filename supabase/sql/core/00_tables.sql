-- Core: the app's main tables (transactions, budget_items, budget_amounts).
-- Safe to run more than once. Applied automatically on merge (scripts/apply-database-setup.mjs), first.
--
-- A brand-new Supabase project needs these before anything else. On an existing project nothing
-- changes: tables that exist are left as they are, and their row-level security rules are only
-- added if a table has none at all (so an existing, stricter rule is never loosened).
-- Columns added later (bank links, subscriptions, paybacks, renames, order) come from the other
-- setup files.

-- Every transaction: money in, out, saved, moved
create table if not exists public.transactions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type            text not null,             -- income, expense, savings, investment, reimbursement, withdrawal, transfer
  category_id     uuid,                      -- not used any more; kept for older data
  amount          numeric(12, 2) not null,
  name            text,
  note            text,
  category_label  text,
  date            date not null,
  created_at      timestamptz not null default now()
);
create index if not exists transactions_user_date_idx on public.transactions (user_id, date);

-- Budget categories: income, spending, savings, investments
create table if not exists public.budget_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  type        text not null,                 -- income, expense, savings, investment
  is_fixed    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists budget_items_user_id_idx on public.budget_items (user_id);

-- The planned amount for each category, each month
create table if not exists public.budget_amounts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  budget_item_id  uuid not null references public.budget_items (id) on delete cascade,
  month           integer not null check (month between 1 and 12),
  year            integer not null,
  amount          numeric(12, 2) not null default 0,
  unique (budget_item_id, month, year)       -- the app saves with "upsert" on these
);
create index if not exists budget_amounts_user_year_idx on public.budget_amounts (user_id, year);

-- Each person only ever sees and changes their own rows
do $$
declare t text;
begin
  foreach t in array array['transactions', 'budget_items', 'budget_amounts'] loop
    execute format('alter table public.%I enable row level security', t);
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t) then
      execute format(
        'create policy own_rows on public.%I for all to authenticated
           using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    end if;
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
