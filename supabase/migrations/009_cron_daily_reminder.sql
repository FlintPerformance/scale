-- Daily weight reminder — 13:00 UTC (≈ 8 AM EST)
-- Replaces GitHub Actions cron which has no timing guarantees (5-30+ min late).
select cron.schedule(
  'daily-weight-reminder',
  '0 13 * * *',
  $$
  select net.http_post(
    url := 'https://ytvnytocmratapdwmzns.supabase.co/functions/v1/send-weight-notifications?mode=daily',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0dm55dG9jbXJhdGFwZHdtem5zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjk5MTQxMSwiZXhwIjoyMDg4NTY3NDExfQ.hwsIVbcqYXAlAfpKfSiuZ8b2FQZEUkCvTW9VlzPsHA4',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
