-- =====================================================================
-- Your names for places (safe to run more than once)
-- Run in Supabase: SQL Editor -> New query -> paste -> Run
-- =====================================================================
-- Adds:
--   * transactions.original_name: the bank's (or file's) wording, kept when you rename a
--     transaction, so duplicate checks and matching keep working
--   * merchant_renames: your name for each place, applied to future bank syncs and CSV imports
--   * rename_transactions(ids, name): renames transactions, keeping their original wording
-- Nothing existing is changed or deleted.

alter table public.transactions add column if not exists original_name text;

create table if not exists public.merchant_renames (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  merchant_key  text not null,          -- the place, as the app recognizes it (e.g. 'tacos texas')
  display_name  text not null,          -- what you want to see
  created_at    timestamptz not null default now(),
  unique (user_id, merchant_key)
);

revoke all on public.merchant_renames from anon;
grant select, insert, update, delete on public.merchant_renames to authenticated;
grant all on public.merchant_renames to service_role;

alter table public.merchant_renames enable row level security;

drop policy if exists "Users manage their own names for places" on public.merchant_renames;
create policy "Users manage their own names for places"
  on public.merchant_renames for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Runs as the signed-in user (security invoker), so only their own transactions can change
create or replace function public.rename_transactions(p_ids uuid[], p_name text)
returns integer
language sql
security invoker
set search_path = public
as $$
  with changed as (
    update public.transactions
       set original_name = coalesce(original_name, name),
           name = p_name
     where id = any(p_ids)
    returning 1
  )
  select count(*)::int from changed;
$$;

revoke all on function public.rename_transactions(uuid[], text) from public, anon;
grant execute on function public.rename_transactions(uuid[], text) to authenticated, service_role;
