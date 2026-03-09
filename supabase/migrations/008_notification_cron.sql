-- Move notification scheduling from GitHub Actions to pg_cron + pg_net
-- for reliable, on-time delivery. GitHub Actions cron has no timing guarantees
-- and can run 5-30+ minutes late depending on runner availability.
--
-- Prerequisites: enable pg_cron and pg_net extensions in Supabase Dashboard
-- (Database > Extensions) before running this migration.

-- Enable extensions
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Daily weight reminder — 13:00 UTC (≈ 8 AM EST)
-- Calls the existing send-weight-notifications edge function with mode=daily
select cron.schedule(
  'daily-weight-reminder',
  '0 13 * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url')
           || '/functions/v1/send-weight-notifications?mode=daily',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Weekly progress summary — 17:00 UTC every Sunday (≈ 12 PM EST)
select cron.schedule(
  'weekly-weight-progress',
  '0 17 * * 0',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url')
           || '/functions/v1/send-weight-notifications?mode=weekly',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- CRITICAL: pg_net cleanup job
-- pg_net stores every HTTP response in net._http_response. Over time this table
-- grows unbounded, causing OOM crashes on Supabase free/pro tier Postgres.
-- This purges responses older than 1 hour, every hour.
select cron.schedule(
  'cleanup-pg-net-responses',
  '0 * * * *',
  $$
  delete from net._http_response
  where created < now() - interval '1 hour';
  $$
);
