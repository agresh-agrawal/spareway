-- Photo retention (roadmap item 15): once a day the photo-cleanup Edge Function deletes cargo photos older than
-- 30 days and the photos of deleted companies (same Vault token as the monthly report). Additive file; applied
-- with the Supabase MCP.
select cron.unschedule(jobid) from cron.job where jobname = 'spareway-photo-cleanup';
select cron.schedule(
  'spareway-photo-cleanup',
  '40 21 * * *',
  $cron$
  select net.http_post(
    url := 'https://darwxazznvfocihderma.supabase.co/functions/v1/photo-cleanup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-report-token', (select decrypted_secret from vault.decrypted_secrets where name = 'monthly_report_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $cron$
);
