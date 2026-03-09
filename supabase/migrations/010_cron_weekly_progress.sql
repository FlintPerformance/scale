-- Weekly progress summary — 17:00 UTC every Sunday (≈ 12 PM EST)
select cron.schedule(
  'weekly-weight-progress',
  '0 17 * * 0',
  $$
  select net.http_post(
    url := 'https://ytvnytocmratapdwmzns.supabase.co/functions/v1/send-weight-notifications?mode=weekly',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0dm55dG9jbXJhdGFwZHdtem5zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjk5MTQxMSwiZXhwIjoyMDg4NTY3NDExfQ.hwsIVbcqYXAlAfpKfSiuZ8b2FQZEUkCvTW9VlzPsHA4',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
