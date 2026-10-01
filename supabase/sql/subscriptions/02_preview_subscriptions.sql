-- =====================================================================
-- Subscriptions, step 2 of 4: preview the subscriptions that will be created
-- Read only: this changes nothing. Run after 01_setup.sql.
-- =====================================================================
-- The old system marked transactions as "recurring" and copied them. Each copy
-- was also marked recurring, so copies multiplied. Step 4 groups rows that are
-- the same charge (same name, amount, type, category and frequency) into one
-- subscription, keeps one row per date, and deletes the extra copies.
--
-- One result row per subscription step 4 will create.

select
  coalesce(nullif(max(name), ''), nullif(max(category_label), ''), 'Subscription') as subscription_name,
  type,
  amount,
  recurring                        as frequency,
  count(*)                         as rows_now,
  count(distinct date)             as rows_kept,
  count(*) - count(distinct date)  as copies_to_delete,
  min(date)                        as earliest_date,
  max(date)                        as latest_date
from public.transactions
where recurring in ('weekly', 'biweekly', 'monthly', 'yearly')
group by user_id, coalesce(name, ''), amount, type, coalesce(category_label, ''), recurring
order by subscription_name;
