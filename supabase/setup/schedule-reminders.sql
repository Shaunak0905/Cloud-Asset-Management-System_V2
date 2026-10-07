-- =============================================================================
-- Schedule the send-reminders Edge Function (run ONCE in the SQL Editor,
-- after the function is deployed — see README → Reminders).
--
-- Not a migration: it contains your project's address and a secret, so it is
-- run by hand with the two placeholders replaced:
--
--   YOUR-PROJECT-REF        the <ref> in https://<ref>.supabase.co
--   PASTE-THE-SECRET-HERE   the same value you set as the function's
--                           REMINDERS_SECRET (a long random string)
--
-- Supabase Cron (pg_cron) calls the function over HTTP (pg_net) every day at
-- 07:00 campus time (01:30 UTC). The secret is kept in Supabase Vault, not in
-- the job's text.
-- =============================================================================

-- 1. Extensions (also available under Database → Extensions).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2. The shared secret, stored encrypted in Vault.
select vault.create_secret('PASTE-THE-SECRET-HERE', 'reminders_secret');

-- 3. The daily job.
select cron.schedule(
  'send-reminders-daily',
  '30 1 * * *',
  $$
  select net.http_post(
    url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-reminders-secret', (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'reminders_secret'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- To check:   select jobname, schedule, active from cron.job;
-- Last runs:  select status, return_message, start_time
--             from cron.job_run_details order by start_time desc limit 5;
-- To stop:    select cron.unschedule('send-reminders-daily');
