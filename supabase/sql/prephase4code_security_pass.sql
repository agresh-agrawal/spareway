-- Security pass (roadmap items 1, 2 and 9). Additive file; applied with the Supabase MCP.
-- * links: loader / driver links close by themselves 48 h after the trip ends (daily cron), on top of the
--   existing 48 h loader expiry and the owner's "Turn off".
-- * providers: the owner can block a trader / shipper — their page link changes at once (old link dead), their
--   open loads are taken off, and the same mobile cannot join again through the provider link.
-- * advisor fixes: fixed search_path on _phone_key; no anon execute on owner-only functions.

alter function public._phone_key(text) set search_path = public;

alter table public.providers add column if not exists blocked boolean not null default false;

create or replace function public.provider_join(p_token text, p_kind text, p_name text, p_phone text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_link public.provider_links; v_key text := public._phone_key(p_phone); v_portal text;
  v_name text := left(trim(coalesce(p_name, '')), 80);
begin
  select * into v_link from public.provider_links where token = p_token and enabled;
  if not found then return jsonb_build_object('error', 'LINK_INVALID'); end if;
  if p_kind not in ('trader', 'shipper') or length(v_name) < 2 or v_key !~ '^[6-9][0-9]{9}$' then
    return jsonb_build_object('error', 'BAD_ITEMS');
  end if;
  if exists (select 1 from public.providers where company_id = v_link.company_id and phone = v_key and blocked) then
    return jsonb_build_object('error', 'LINK_INVALID');
  end if;
  insert into public.providers (company_id, link_id, kind, name, phone, portal_token)
  values (v_link.company_id, v_link.id, p_kind, v_name, v_key, encode(gen_random_bytes(16), 'hex'))
  on conflict (company_id, phone) do update set kind = excluded.kind, name = excluded.name, link_id = excluded.link_id
  returning portal_token into v_portal;
  return jsonb_build_object('portalToken', v_portal);
end;
$$;

-- owner: block / unblock a provider of their own company
create or replace function public.block_provider(p_id uuid, p_block boolean)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_company uuid := public.current_company_id(); v_n int;
begin
  if v_company is null then raise exception 'NOT_SIGNED_IN'; end if;
  update public.providers
     set blocked = p_block,
         portal_token = case when p_block then encode(gen_random_bytes(16), 'hex') else portal_token end
   where id = p_id and company_id = v_company;
  get diagnostics v_n = row_count;
  if v_n = 0 then return jsonb_build_object('error', 'NOT_FOUND'); end if;
  if p_block then
    update public.freight_listings set status = 'expired'
     where provider_id = p_id and company_id = v_company and status = 'open';
  end if;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.block_provider(uuid, boolean) from public, anon;
grant execute on function public.block_provider(uuid, boolean) to authenticated;

-- daily: links of trips that ended more than 48 h ago stop working
create or replace function public.close_old_links()
returns int language sql security definer set search_path = public as $$
  with u as (
    update public.trips set loader_link_enabled = false, driver_link_enabled = false
     where status in ('completed', 'cancelled')
       and (loader_link_enabled or driver_link_enabled)
       and coalesce(completed_at, updated_at, created_at) < now() - interval '48 hours'
    returning 1
  ) select count(*)::int from u;
$$;
revoke all on function public.close_old_links() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'spareway-close-old-links';
select cron.schedule('spareway-close-old-links', '15 21 * * *', $cron$ select public.close_old_links(); $cron$);

-- owner-only functions: never callable without signing in
revoke execute on function public.seed_sample_data() from anon;
revoke execute on function public.reset_sample_data() from anon;
revoke execute on function public.get_provider_link(boolean) from anon;
revoke execute on function public.create_loader_link(uuid) from anon;
revoke execute on function public.disable_loader_link(uuid) from anon;
revoke execute on function public.create_driver_link(uuid) from anon;
revoke execute on function public.disable_driver_link(uuid) from anon;

-- profiles: an owner may change only their own name, language and email choice (not id / company / email)
revoke update on public.profiles from authenticated;
grant update (full_name, preferred_lang, email_notify) on public.profiles to authenticated;
