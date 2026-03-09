-- Daily weight reminder — 13:00 UTC (≈ 8 AM EST)
-- Replaces GitHub Actions cron which has no timing guarantees (5-30+ min late).
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
