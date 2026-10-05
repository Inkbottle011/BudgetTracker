-- =====================================================================
-- Subscriptions, step 4 of 4: convert old recurring transactions
-- Run after checking steps 2 and 3. Safe to run again: once converted,
-- there's nothing left for it to do.
-- =====================================================================
-- What it does, as ONE statement (so it all happens or none of it does):
--   a) deletes the extra copies listed by step 3
--   b) creates one subscription per group listed by step 2
--   c) links the remaining rows to their subscription and clears their old
--      "recurring" flag, so the old copying code can't touch them again
--
-- Note: the old code moved charges' dates forward, so earlier charges it lost
-- can't be recovered. Each subscription starts from the earliest date still
-- in your data and continues from the latest; add any missing past charges by hand.

with
old_rows as (
  select
    t.*,
    row_number() over (
      partition by user_id, coalesce(name, ''), amount, type, coalesce(category_label, ''), recurring, date
      order by created_at, id
    ) as copy_number
  from public.transactions t
  where recurring in ('weekly', 'biweekly', 'monthly', 'yearly')
),

-- a) Delete duplicate copies, keeping the oldest row for each charge and date
deleted as (
  delete from public.transactions t
  using old_rows o
  where t.id = o.id
    and o.copy_number > 1
  returning t.id
),

-- b) One subscription per group
groups as materialized (
  select
    gen_random_uuid()                                  as new_id,
    user_id,
    coalesce(name, '')                                 as name_key,
    amount,
    type,
    coalesce(category_label, '')                       as category_key,
    recurring                                          as frequency,
    min(date::date)                                    as first_date,
    max(date::date)                                    as last_date,
    max(nullif(recurring_end::text, '')::date)         as old_end_date,
    (array_agg(note order by date desc))[1]            as latest_note
  from old_rows
  group by user_id, coalesce(name, ''), amount, type, coalesce(category_label, ''), recurring
),
created as (
  insert into public.subscriptions
    (id, user_id, name, amount, type, category_label, note, frequency,
     start_date, end_date, status, generated_through)
  select
    new_id,
    user_id,
    coalesce(nullif(name_key, ''), nullif(category_key, ''), 'Subscription'),
    amount,
    type,
    nullif(category_key, ''),
    latest_note,
    frequency,
    first_date,
    case when old_end_date >= first_date then old_end_date end,
    case when old_end_date < first_date then 'cancelled' else 'active' end,
    last_date
  from groups
  returning id
),

-- c) Link the rows that are kept and retire the old recurring flag
linked as (
  update public.transactions t
  set subscription_id = g.new_id,
      recurring       = 'none',
      recurring_end   = null
  from old_rows o
  join groups g
    on  o.user_id = g.user_id
    and coalesce(o.name, '') = g.name_key
    and o.amount = g.amount
    and o.type = g.type
    and coalesce(o.category_label, '') = g.category_key
    and o.recurring = g.frequency
  where t.id = o.id
    and o.copy_number = 1
  returning t.id
)

select
  (select count(*) from deleted) as duplicate_copies_deleted,
  (select count(*) from created) as subscriptions_created,
  (select count(*) from linked)  as transactions_linked;
