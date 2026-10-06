-- =====================================================================
-- Subscriptions, step 1 of 4: set up (safe to run more than once)
-- Run in Supabase: SQL Editor -> New query -> paste -> Run
-- =====================================================================
-- Adds:
--   * a `subscriptions` table: one row per repeating charge (Netflix, rent, salary...)
--   * `transactions.subscription_id`: links each real charge to its subscription
--   * a rule that the same subscription can't be charged twice on the same date
--   * `generate_subscription_transactions()`: adds every charge that's due and missing.
--     The app calls it when it opens, and the scheduled job calls it daily, so charges
--     missed while the project was paused get filled in once, on their real dates.
-- Nothing existing is changed or deleted by this file.

-- 1. Subscriptions table ------------------------------------------------
create table if not exists public.subscriptions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name              text not null check (length(trim(name)) > 0),
  amount            numeric(12, 2) not null check (amount > 0),
  type              text not null default 'expense'
                    check (type in ('income', 'expense', 'savings', 'investment')),
  category_label    text,
  note              text,
  frequency         text not null check (frequency in ('weekly', 'biweekly', 'monthly', 'yearly')),
  start_date        date not null,                 -- date of the first charge; later charges count from here
  end_date          date check (end_date is null or end_date >= start_date),
  status            text not null default 'active' check (status in ('active', 'paused', 'cancelled')),
  generated_through date,                          -- charges up to this date have already been added
  created_at        timestamptz not null default now()
);

create index if not exists subscriptions_user_id_idx on public.subscriptions (user_id);

-- 2. Only owners can see or change their subscriptions --------------------
-- Newer Supabase projects don't give the app access to new tables automatically,
-- so grant it; the row-level security policy below still limits each user to their own rows.
grant select, insert, update, delete on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;

alter table public.subscriptions enable row level security;

drop policy if exists "Users manage their own subscriptions" on public.subscriptions;
create policy "Users manage their own subscriptions"
  on public.subscriptions
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 3. Link transactions to the subscription that created them -------------
alter table public.transactions
  add column if not exists subscription_id uuid
  references public.subscriptions (id) on delete set null;  -- deleting a subscription keeps its past charges

-- The database itself refuses a second charge for the same subscription on the same date
create unique index if not exists transactions_subscription_date_key
  on public.transactions (subscription_id, date)
  where subscription_id is not null;

-- 4. Date of the n-th charge (n = 0 is the start date) ------------------
-- Always counted from the start date, so monthly charges don't drift:
-- Jan 31 -> Feb 28 -> Mar 31 -> Apr 30 (each month uses its last day if needed).
create or replace function public.subscription_occurrence(p_start date, p_frequency text, p_n integer)
returns date
language sql
immutable
set search_path = public
as $$
  select case p_frequency
    when 'weekly'   then p_start + 7 * p_n
    when 'biweekly' then p_start + 14 * p_n
    when 'monthly'  then (p_start + make_interval(months => p_n))::date
    when 'yearly'   then (p_start + make_interval(years => p_n))::date
  end
$$;

-- 5. Add every charge that's due and not added yet ------------------------
-- Called by the app (signed in: only that user's subscriptions) and by the
-- scheduled job (service role: everyone's). Returns how many charges were added.
-- p_today lets the app pass the user's local date; it can't be set in the future.
create or replace function public.generate_subscription_transactions(p_today date default current_date)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  s          record;
  n          integer;
  d          date;
  last_due   date;
  added      integer := 0;
  row_count_ integer;
begin
  if p_today is null or p_today > current_date + 1 then
    p_today := current_date;
  end if;

  for s in
    select *
    from subscriptions
    where status = 'active'
      and start_date <= p_today
      and (auth.uid() is null or user_id = auth.uid())
    for update skip locked   -- if two runs overlap, each subscription is handled by only one
  loop
    last_due := least(p_today, coalesce(s.end_date, p_today));
    n := 0;
    loop
      d := subscription_occurrence(s.start_date, s.frequency, n);
      exit when d > last_due;

      -- Skip charges already added earlier (so a charge you deleted doesn't come back)
      if s.generated_through is null or d > s.generated_through then
        insert into transactions (user_id, type, category_id, amount, name, note, category_label, date, subscription_id)
        values (s.user_id, s.type, null, s.amount, s.name, s.note, s.category_label, d, s.id)
        on conflict (subscription_id, date) where subscription_id is not null do nothing;
        get diagnostics row_count_ = row_count;
        added := added + row_count_;
      end if;

      n := n + 1;
    end loop;

    update subscriptions
    set generated_through = greatest(coalesce(generated_through, last_due), last_due)
    where id = s.id;
  end loop;

  return added;
end;
$$;

-- Signed-in users and the scheduled job may run it; the public (anon) key may not
revoke all on function public.generate_subscription_transactions(date) from public, anon;
grant execute on function public.generate_subscription_transactions(date) to authenticated, service_role;
