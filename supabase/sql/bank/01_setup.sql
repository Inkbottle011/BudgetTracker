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
-- Reading bank details also requires having passed two-factor sign-in.
-- Nothing existing is changed or deleted.

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

-- 4. Who can do what ---------------------------------------------------------------
-- The app (signed-in users) may only READ, and only the columns below: no token.
-- Creating, updating and deleting connections happens in the server function.
revoke all on public.bank_connections from anon, authenticated;
revoke all on public.bank_accounts from anon, authenticated;
grant select (id, user_id, provider, institution_name, status, last_error, sync_from, last_synced_at, created_at)
  on public.bank_connections to authenticated;
grant select on public.bank_accounts to authenticated;
grant all on public.bank_connections, public.bank_accounts to service_role;

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
