-- =====================================================================
-- Subscriptions, step 4 of 4: convert old recurring transactions
-- Run after checking steps 2 and 3. Safe to run again: once converted,
-- there's nothing left for it to do.
-- =====================================================================
-- What it does, all in one transaction (if anything fails, nothing changes):
--   a) deletes the extra copies listed by step 3
--   b) creates one subscription per group listed by step 2
--   c) links the remaining rows to their subscription and clears their old
--      "recurring" flag, so the old copying code can't touch them again
--
-- Note: the old code moved charges' dates forward, so earlier charges it lost
-- can't be recovered. Each subscription starts from the earliest date still
-- in your data and continues from the latest; add any missing past charges by hand.

begin;

-- a) Delete duplicate copies, keeping the oldest row for each charge and date
with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, coalesce(name, ''), amount, type, coalesce(category_label, ''), recurring, date
      order by created_at, id
    ) as copy_number
  from public.transactions
  where recurring in ('weekly', 'biweekly', 'monthly', 'yearly')
)
delete from public.transactions t
using ranked r
where t.id = r.id
  and r.copy_number > 1;

-- b) One subscription per group
create temporary table old_recurring_groups on commit drop as
select
  gen_random_uuid()                                      as new_id,
  user_id,
  coalesce(name, '')                                     as name_key,
  amount,
  type,
  coalesce(category_label, '')                           as category_key,
  recurring                                              as frequency,
  min(date::date)                                        as first_date,
  max(date::date)                                        as last_date,
  max(nullif(recurring_end::text, '')::date)             as old_end_date,
  (array_agg(note order by date desc))[1]                as latest_note
from public.transactions
where recurring in ('weekly', 'biweekly', 'monthly', 'yearly')
group by user_id, coalesce(name, ''), amount, type, coalesce(category_label, ''), recurring;

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
from old_recurring_groups;

-- c) Link the remaining rows and retire the old recurring flag
update public.transactions t
set subscription_id = g.new_id,
    recurring       = 'none',
    recurring_end   = null
from old_recurring_groups g
where t.user_id = g.user_id
  and coalesce(t.name, '') = g.name_key
  and t.amount = g.amount
  and t.type = g.type
  and coalesce(t.category_label, '') = g.category_key
  and t.recurring = g.frequency;

commit;

-- Your subscriptions after the conversion
select name, type, amount, frequency, start_date, generated_through as last_charge, status
from public.subscriptions
order by name;
