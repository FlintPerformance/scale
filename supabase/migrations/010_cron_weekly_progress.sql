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
