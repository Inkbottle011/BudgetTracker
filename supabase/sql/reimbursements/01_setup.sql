-- =====================================================================
-- Reimbursements and split expenses (safe to run more than once)
-- Run in Supabase: SQL Editor -> New query -> paste -> Run
-- =====================================================================
-- Adds:
--   * a 'reimbursement' transaction type: money paid back to you (Venmo from a friend, a refund).
--     It reduces spending in its category instead of counting as income.
--   * transactions.reimburses_id: links a reimbursement to the expense it pays back
--   * split_shares: who owes you how much for an expense, and which reimbursement settled it
-- Nothing existing is changed or deleted, except widening a limit on transaction types if you have one.

-- 1. Allow the 'reimbursement' type -------------------------------------
-- If the transactions table limits which types are allowed, replace that limit with one
-- that also allows 'reimbursement'. If there's no limit, nothing changes.
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
      and pg_get_constraintdef(oid) !~* 'reimbursement'
  loop
    execute format('alter table public.transactions drop constraint %I', c.conname);
    had_limit := true;
  end loop;
  if had_limit then
    alter table public.transactions add constraint transactions_type_check
      check (type in ('income', 'expense', 'savings', 'investment', 'reimbursement'));
  end if;
end $$;

-- 2. Link a reimbursement to the expense it pays back --------------------
alter table public.transactions
  add column if not exists reimburses_id uuid
  references public.transactions (id) on delete set null;  -- deleting the expense keeps the payback

create index if not exists transactions_reimburses_id_idx on public.transactions (reimburses_id);

-- 3. Who owes you for an expense ------------------------------------------
create table if not exists public.split_shares (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  expense_id  uuid not null references public.transactions (id) on delete cascade,
  person      text not null check (length(trim(person)) > 0),
  amount      numeric(12, 2) not null check (amount > 0),
  settled_by  uuid references public.transactions (id) on delete set null,  -- the reimbursement; deleting it reopens the share
  created_at  timestamptz not null default now()
);

create index if not exists split_shares_user_id_idx on public.split_shares (user_id);
create index if not exists split_shares_expense_id_idx on public.split_shares (expense_id);

-- Newer Supabase projects don't give the app access to new tables automatically
grant select, insert, update, delete on public.split_shares to authenticated;
grant all on public.split_shares to service_role;

-- Each user only sees their own shares, and can only attach them to their own transactions
alter table public.split_shares enable row level security;

drop policy if exists "Users manage their own split shares" on public.split_shares;
create policy "Users manage their own split shares"
  on public.split_shares
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.transactions t where t.id = expense_id and t.user_id = (select auth.uid()))
    and (settled_by is null
         or exists (select 1 from public.transactions t where t.id = settled_by and t.user_id = (select auth.uid())))
  );
