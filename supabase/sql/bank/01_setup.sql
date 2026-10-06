-- =====================================================================
-- Linked banks (safe to run more than once)
-- Run in Supabase: SQL Editor -> New query -> paste -> Run
-- =====================================================================
-- Adds:
--   * bank_connections: one row per bank login linked through a provider (Teller for now).
--     The provider's access token is stored ENCRYPTED, and the app itself can never read it:
--     only the server-side "bank" function (service role) can.
--   * bank_accounts: the accounts inside each linked bank
--   * transactions.provider / external_id / bank_account_id: where a transaction came from,
--     so the same bank transaction is never saved twice
--   * a 'transfer' transaction type: money moving between your own accounts (savings -> checking,
--     paying a card). Shown in your list but never counted as income or spending.
--   * bank_possible_duplicates: bank transactions that look like ones you already have
--     (same amount, a few days apart, different name), held back until you decide
-- Reading bank details also requires having passed two-factor sign-in.
-- Nothing existing is changed or deleted, except widening a limit on transaction types if you have one.

-- 1. Linked banks ------------------------------------------------------------
create table if not exists public.bank_connections (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users (id) on delete cascade,
  provider                text not null,                   -- 'teller' (others can be added later)
  provider_enrollment_id  text not null,
  institution_name        text,
  encrypted_token         text not null,                   -- never readable by the app
  status                  text not null default 'active' check (status in ('active', 'error', 'needs_relink')),
  last_error              text,
  sync_from               date not null,                   -- don't import anything before this date
  last_synced_at          timestamptz,
  created_at              timestamptz not null default now(),
  unique (provider, provider_enrollment_id)
);

create index if not exists bank_connections_user_id_idx on public.bank_connections (user_id);

-- Whether transfers already imported from this bank have been found and marked (done once, on the next sync)
alter table public.bank_connections add column if not exists transfers_checked boolean not null default false;

-- 2. Accounts inside each linked bank ------------------------------------------
create table if not exists public.bank_accounts (
  id                   uuid primary key default gen_random_uuid(),
  connection_id        uuid not null references public.bank_connections (id) on delete cascade,
  user_id              uuid not null references auth.users (id) on delete cascade,
  provider_account_id  text not null,
  name                 text,
  type                 text,          -- 'depository' or 'credit'
  subtype              text,
  last_four            text,
  created_at           timestamptz not null default now(),
  unique (connection_id, provider_account_id)
);

create index if not exists bank_accounts_user_id_idx on public.bank_accounts (user_id);

-- Latest balances, refreshed on every sync. For cards, balance_current is what's owed and
-- balance_available is the credit left.
alter table public.bank_accounts add column if not exists balance_current numeric(14, 2);
alter table public.bank_accounts add column if not exists balance_available numeric(14, 2);
alter table public.bank_accounts add column if not exists balance_updated_at timestamptz;

-- 3. Where each transaction came from -------------------------------------------
alter table public.transactions add column if not exists provider text;
alter table public.transactions add column if not exists external_id text;
alter table public.transactions add column if not exists bank_account_id uuid
  references public.bank_accounts (id) on delete set null;   -- unlinking a bank keeps its transactions

-- The same bank transaction can only be saved once per user. Hand-entered rows have no
-- external_id, and empty values never clash, so they're unaffected.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'transactions_external_key') then
    alter table public.transactions
      add constraint transactions_external_key unique (user_id, provider, external_id);
  end if;
end $$;

-- Allow the 'transfer' type. If the transactions table limits which types are allowed, replace that
-- limit with one that also allows 'transfer' (and 'reimbursement'). If there's no limit, nothing changes.
do $$
declare
  c record;
  had_limit boolean := false;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.transactions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ~* '\mtype\M'
      and pg_get_constraintdef(oid) !~* 'transfer'
  loop
    execute format('alter table public.transactions drop constraint %I', c.conname);
    had_limit := true;
  end loop;
  if had_limit then
    alter table public.transactions add constraint transactions_type_check
      check (type in ('income', 'expense', 'savings', 'investment', 'reimbursement', 'transfer'));
  end if;
end $$;

-- 4. Who can do what ---------------------------------------------------------------
-- The app (signed-in users) may only READ, and only the columns below: no token.
-- Creating, updating and deleting connections happens in the server function.
revoke all on public.bank_connections from anon, authenticated;
revoke all on public.bank_accounts from anon, authenticated;
grant select (id, user_id, provider, institution_name, status, last_error, sync_from, last_synced_at, created_at)
  on public.bank_connections to authenticated;
grant select on public.bank_accounts to authenticated;
grant all on public.bank_connections, public.bank_accounts to service_role;
-- The server function saves bank transactions into your transactions table. Newer Supabase
-- projects don't give service_role access to tables automatically, so grant it here.
grant select, insert, update, delete on public.transactions to service_role;
grant usage, select on all sequences in schema public to service_role;

alter table public.bank_connections enable row level security;
alter table public.bank_accounts enable row level security;

-- Own rows only, and only after two-factor sign-in (aal2 = "authenticator assurance level 2")
drop policy if exists "Users see their own linked banks" on public.bank_connections;
create policy "Users see their own linked banks"
  on public.bank_connections for select to authenticated
  using (user_id = (select auth.uid()) and (select auth.jwt() ->> 'aal') = 'aal2');

drop policy if exists "Users see their own bank accounts" on public.bank_accounts;
create policy "Users see their own bank accounts"
  on public.bank_accounts for select to authenticated
  using (user_id = (select auth.uid()) and (select auth.jwt() ->> 'aal') = 'aal2');

-- 5. Possible duplicates, waiting for you to decide ---------------------------------
-- A bank transaction with the same amount as one of yours, within a few days, but a different
-- name. It isn't added to your transactions (so nothing is counted twice) until you choose:
--   keep_mine  yours stays and takes the bank's id, so the bank's copy is never offered again
--   use_bank   the bank's copy replaces yours
--   keep_both  they're really two transactions
create table if not exists public.bank_possible_duplicates (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users (id) on delete cascade,
  provider                 text not null,
  external_id              text not null,
  bank_account_id          uuid references public.bank_accounts (id) on delete set null,
  date                     date not null,
  amount                   numeric(14, 2) not null,
  type                     text not null,
  name                     text,
  category_label           text,
  existing_transaction_id  uuid references public.transactions (id) on delete set null,
  created_at               timestamptz not null default now(),
  unique (user_id, provider, external_id)
);

create index if not exists bank_possible_duplicates_user_id_idx on public.bank_possible_duplicates (user_id);

revoke all on public.bank_possible_duplicates from anon, authenticated;
grant select, delete on public.bank_possible_duplicates to authenticated;
grant all on public.bank_possible_duplicates to service_role;

alter table public.bank_possible_duplicates enable row level security;

drop policy if exists "Users see their own possible duplicates" on public.bank_possible_duplicates;
create policy "Users see their own possible duplicates"
  on public.bank_possible_duplicates for select to authenticated
  using (user_id = (select auth.uid()) and (select auth.jwt() ->> 'aal') = 'aal2');

drop policy if exists "Users resolve their own possible duplicates" on public.bank_possible_duplicates;
create policy "Users resolve their own possible duplicates"
  on public.bank_possible_duplicates for delete to authenticated
  using (user_id = (select auth.uid()) and (select auth.jwt() ->> 'aal') = 'aal2');

-- Runs as the signed-in user (security invoker), so their own row-level security still applies
create or replace function public.resolve_possible_duplicate(p_id uuid, p_choice text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  d public.bank_possible_duplicates;
begin
  if p_choice is null or p_choice not in ('keep_mine', 'use_bank', 'keep_both') then
    raise exception 'Unknown choice: %', p_choice;
  end if;

  delete from public.bank_possible_duplicates where id = p_id returning * into d;
  if not found then
    raise exception 'Possible duplicate not found';
  end if;

  if p_choice = 'keep_mine' then
    update public.transactions
       set provider = d.provider, external_id = d.external_id, bank_account_id = d.bank_account_id
     where id = d.existing_transaction_id and external_id is null;
    return;
  end if;

  if p_choice = 'use_bank' and d.existing_transaction_id is not null then
    delete from public.transactions where id = d.existing_transaction_id;
  end if;

  insert into public.transactions (user_id, provider, external_id, bank_account_id, date, amount, type, name, note, category_label)
  values (d.user_id, d.provider, d.external_id, d.bank_account_id, d.date, d.amount, d.type, d.name, '', d.category_label)
  on conflict on constraint transactions_external_key do nothing;
end;
$$;

revoke all on function public.resolve_possible_duplicate(uuid, text) from public, anon;
grant execute on function public.resolve_possible_duplicate(uuid, text) to authenticated, service_role;
