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
