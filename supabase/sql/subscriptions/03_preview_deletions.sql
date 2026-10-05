-- =====================================================================
-- Subscriptions, step 3 of 4: preview the duplicate copies that will be deleted
-- Read only: this changes nothing.
-- =====================================================================
-- Each result row is a transaction step 4 will delete. For every date, one copy
-- of each charge is kept (the oldest); these are the extras.
-- If this list is empty, step 4 deletes nothing.

with ranked as (
  select
    t.*,
    row_number() over (
      partition by user_id, coalesce(name, ''), amount, type, coalesce(category_label, ''), recurring, date
      order by created_at, id
    ) as copy_number
  from public.transactions t
  where recurring in ('weekly', 'biweekly', 'monthly', 'yearly')
)
select id, date, name, amount, type, category_label, recurring, created_at
from ranked
where copy_number > 1
order by name, date, created_at;
