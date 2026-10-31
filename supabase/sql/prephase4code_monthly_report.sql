-- Monthly email report (owner request 6): pg_cron calls the monthly-report Edge Function at 09:00 IST on the 1st
-- of each month. The call carries a random token kept in Vault; the function checks it with check_report_token.
-- Additive file; applied with the Supabase MCP.
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'monthly_report_token') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'monthly_report_token', 'monthly-report cron token');
  end if;
end $$;

create or replace function public.check_report_token(p_token text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'monthly_report_token' and decrypted_secret = p_token)
    and coalesce(p_token, '') <> '';
$$;
revoke all on function public.check_report_token(text) from public, anon, authenticated;
grant execute on function public.check_report_token(text) to service_role;

-- 03:30 UTC = 09:00 IST on the 1st
select cron.unschedule(jobid) from cron.job where jobname = 'spareway-monthly-report';
select cron.schedule(
  'spareway-monthly-report',
  '30 3 1 * *',
  $cron$
  select net.http_post(
    url := 'https://darwxazznvfocihderma.supabase.co/functions/v1/monthly-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-report-token', (select decrypted_secret from vault.decrypted_secrets where name = 'monthly_report_token')
    ),
    body := '{"mode":"cron"}'::jsonb,
    timeout_milliseconds := 60000
  );
  $cron$
);
