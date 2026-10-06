-- =====================================================================
-- Linked banks: sync every day at about 6am Eastern (optional; safe to run again)
-- Run in Supabase: SQL Editor -> New query -> paste -> Run
-- =====================================================================
-- Before running, replace the two placeholders below:
--   YOUR-PROJECT-REF   from Project Settings -> General (e.g. abcdefghijklmnop)
--   YOUR-CRON-SECRET   the same value you set as the CRON_SECRET function secret
-- The secret is kept in Supabase Vault (encrypted), not in the schedule itself.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Store (or replace) the secret in the vault
do $$
begin
  if exists (select 1 from vault.secrets where name = 'bank_cron_secret') then
    perform vault.update_secret((select id from vault.secrets where name = 'bank_cron_secret'), 'YOUR-CRON-SECRET');
  else
    perform vault.create_secret('YOUR-CRON-SECRET', 'bank_cron_secret');
  end if;
end $$;

-- Replace any earlier version of the schedule
select cron.unschedule(jobid) from cron.job where jobname = 'bank-daily-sync';

select cron.schedule(
  'bank-daily-sync',
  '17 10 * * *',   -- 10:17 UTC = 6:17am Eastern (5:17am in winter)
  $$
  select net.http_post(
    url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/bank',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'bank_cron_secret')
    ),
    body := '{"action": "sync-all"}'::jsonb
  );
  $$
);

-- Check it's there:  select jobname, schedule from cron.job;
-- See recent runs:   select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
