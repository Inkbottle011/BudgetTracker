-- Budget: the order of your budget items, so you can move them around.
-- Safe to run more than once. Applied automatically on merge (scripts/apply-database-setup.mjs).
--
-- budget_items.position: where an item sits within its section (lower comes first). Empty for items
-- never moved; those keep their place by when they were added. Adding a column with no default is
-- instant and doesn't lock the table for long. Row-level security on budget_items already covers it.

do $$
begin
  if to_regclass('public.budget_items') is not null then
    alter table public.budget_items add column if not exists position integer;
  end if;
end $$;
