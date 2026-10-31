-- Monthly report email settings from Vault (owner gave the Brevo key; this client can't set Edge Function
-- secrets). The values themselves are stored with vault.create_secret('…', 'brevo_api_key' | 'brevo_sender')
-- outside git. Only the service role (the monthly-report Edge Function) can read them.
create or replace function public.report_email_config()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'apiKey', (select decrypted_secret from vault.decrypted_secrets where name = 'brevo_api_key'),
    'sender', (select decrypted_secret from vault.decrypted_secrets where name = 'brevo_sender'));
$$;
revoke all on function public.report_email_config() from public, anon, authenticated;
grant execute on function public.report_email_config() to service_role;
