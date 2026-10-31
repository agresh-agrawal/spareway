-- Load providers (Pre-Phase 4, stage 5): no login. The owner shares one provider link (QR / WhatsApp); the provider
-- posts one or more loads on it. Every load gets its own share link where the provider sees it, edits it while it is
-- open, cancels it, and answers counter-offers from truck owners. Owners discover the loads on the Loads page and
-- send counter-offers. Additive file; applied with the Supabase MCP.

create table if not exists public.provider_links (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null default public.current_company_id() references public.companies (id) on delete cascade,
  token       text not null unique,
  enabled     boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table public.provider_links enable row level security;
drop policy if exists provider_links_own_company on public.provider_links;
create policy provider_links_own_company on public.provider_links for all to authenticated
  using (company_id = public.current_company_id()) with check (company_id = public.current_company_id());

alter table public.freight_listings
  add column if not exists share_token text unique,
  add column if not exists provider_link_id uuid references public.provider_links (id) on delete set null;

create table if not exists public.listing_offers (
  id           uuid primary key default gen_random_uuid(),
  listing_id   uuid not null references public.freight_listings (id) on delete cascade,
  company_id   uuid not null default public.current_company_id() references public.companies (id) on delete cascade,
  amount_inr   numeric not null check (amount_inr > 0 and amount_inr <= 10000000),
  note         text not null default '',
  status       text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at   timestamptz not null default now(),
  answered_at  timestamptz
);
create index if not exists listing_offers_listing_idx on public.listing_offers (listing_id);
alter table public.listing_offers enable row level security;
drop policy if exists listing_offers_select on public.listing_offers;
drop policy if exists listing_offers_insert on public.listing_offers;
drop policy if exists listing_offers_update on public.listing_offers;
-- my offers, and offers on loads my company shared
create policy listing_offers_select on public.listing_offers for select to authenticated
  using (company_id = public.current_company_id()
         or exists (select 1 from public.freight_listings f where f.id = listing_id and f.company_id = public.current_company_id()));
create policy listing_offers_insert on public.listing_offers for insert to authenticated
  with check (company_id = public.current_company_id() and status = 'pending'
              and exists (select 1 from public.freight_listings f where f.id = listing_id and f.status = 'open'));
-- an owner can only withdraw their own pending offer
create policy listing_offers_update on public.listing_offers for update to authenticated
  using (company_id = public.current_company_id() and status = 'pending')
  with check (company_id = public.current_company_id() and status = 'withdrawn');

alter table public.alerts drop constraint if exists alerts_kind_check;
alter table public.alerts add constraint alerts_kind_check
  check (kind in ('loader_issue', 'loader_cargo', 'driver_challan', 'driver_stop', 'provider_load', 'offer_answer'));

-- owner: the company's provider link (made on first use); p_new = true replaces it
create or replace function public.get_provider_link(p_new boolean default false)
returns jsonb language plpgsql security invoker set search_path = public, extensions as $$
declare v_token text;
begin
  if public.current_company_id() is null then raise exception 'NOT_SIGNED_IN'; end if;
  if p_new then update public.provider_links set enabled = false where enabled; end if;
  select token into v_token from public.provider_links where enabled order by created_at desc limit 1;
  if v_token is null then
    v_token := encode(gen_random_bytes(18), 'hex');
    insert into public.provider_links (token) values (v_token);
  end if;
  return jsonb_build_object('token', v_token);
end;
$$;
revoke all on function public.get_provider_link(boolean) from public, anon;
grant execute on function public.get_provider_link(boolean) to authenticated;

-- provider (no login): who shared the link
create or replace function public.provider_link_info(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_link public.provider_links; v_company public.companies;
begin
  select * into v_link from public.provider_links where token = p_token and enabled;
  if not found then return jsonb_build_object('error', 'LINK_INVALID'); end if;
  select * into v_company from public.companies where id = v_link.company_id;
  return jsonb_build_object('company', jsonb_build_object('name', v_company.name, 'phone', v_company.phone, 'city', v_company.city));
end;
$$;

-- one load's fields from json, checked; raises BAD_ITEMS
create or replace function public._provider_load_fields(p jsonb)
returns jsonb language plpgsql immutable set search_path = public as $$
begin
  if coalesce(trim(p ->> 'goods'), '') = '' or length(p ->> 'goods') > 60
     or coalesce(trim(p ->> 'pickupName'), '') = '' or coalesce(trim(p ->> 'dropName'), '') = ''
     or (p ->> 'pickupName') = (p ->> 'dropName')
     or (p ->> 'lengthCm')::numeric not between 5 and 1500 or (p ->> 'widthCm')::numeric not between 5 and 1500
     or (p ->> 'heightCm')::numeric not between 5 and 1500 or (p ->> 'weightKg')::numeric not between 0.1 and 40000
     or (p ->> 'quantity')::int not between 1 and 1000 or (p ->> 'priceInr')::numeric not between 1 and 10000000
     or (p ->> 'pickupLat') is null or (p ->> 'dropLat') is null then
    raise exception 'BAD_ITEMS';
  end if;
  return p;
end;
$$;

-- provider posts one or more loads; each gets a code and its own share link
create or replace function public.provider_post_loads(p_token text, p_shipper jsonb, p_loads jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_link public.provider_links;
  v_load jsonb;
  v_code text;
  v_share text;
  v_out jsonb := '[]'::jsonb;
  v_name text := left(trim(coalesce(p_shipper ->> 'name', '')), 80);
  v_phone text := left(trim(coalesce(p_shipper ->> 'phone', '')), 20);
begin
  select * into v_link from public.provider_links where token = p_token and enabled;
  if not found then return jsonb_build_object('error', 'LINK_INVALID'); end if;
  if v_name = '' or v_phone !~ '^[+0-9 -]{10,20}$' then return jsonb_build_object('error', 'BAD_ITEMS'); end if;
  if jsonb_typeof(p_loads) <> 'array' or jsonb_array_length(p_loads) not between 1 and 10 then return jsonb_build_object('error', 'BAD_ITEMS'); end if;
  for v_load in select * from jsonb_array_elements(p_loads) loop
    perform public._provider_load_fields(v_load);
    -- same numbering as next_listing_code(), for the link's company (the provider has no session)
    select 'LD-' || lpad((coalesce(max(nullif(split_part(code, '-', 2), '')::int), 2000) + 1)::text, 4, '0') into v_code
      from public.freight_listings where company_id = v_link.company_id and code ~ '^LD-[0-9]+$';
    v_share := encode(gen_random_bytes(12), 'hex');
    insert into public.freight_listings (company_id, code, visibility, shipper_name, shipper_phone, goods_type, description,
      pickup_name, pickup_lat, pickup_lng, drop_name, drop_lat, drop_lng, length_cm, width_cm, height_cm, weight_kg, quantity,
      fragile, upright_only, stackable, offered_rate_inr, ready_from, deliver_by, status, share_token, provider_link_id)
    values (v_link.company_id, v_code, 'public', v_name, v_phone, trim(v_load ->> 'goods'), left(coalesce(v_load ->> 'note', ''), 200),
      v_load ->> 'pickupName', (v_load ->> 'pickupLat')::float8, (v_load ->> 'pickupLng')::float8,
      v_load ->> 'dropName', (v_load ->> 'dropLat')::float8, (v_load ->> 'dropLng')::float8,
      (v_load ->> 'lengthCm')::numeric, (v_load ->> 'widthCm')::numeric, (v_load ->> 'heightCm')::numeric,
      (v_load ->> 'weightKg')::numeric, (v_load ->> 'quantity')::int,
      coalesce((v_load ->> 'fragile')::boolean, false), false, not coalesce((v_load ->> 'fragile')::boolean, false),
      round((v_load ->> 'priceInr')::numeric), coalesce(nullif(v_load ->> 'readyFrom', '')::timestamptz, now()),
      nullif(v_load ->> 'deliverBy', '')::timestamptz, 'open', v_share, v_link.id);
    v_out := v_out || jsonb_build_object('code', v_code, 'shareToken', v_share);
  end loop;
  insert into public.alerts (company_id, kind, severity, title, message, meta)
  values (v_link.company_id, 'provider_load', 'info', 'New loads from a provider',
          v_name || ' posted ' || jsonb_array_length(p_loads) || ' load(s)',
          jsonb_build_object('name', v_name, 'count', jsonb_array_length(p_loads)));
  return jsonb_build_object('ok', true, 'loads', v_out);
end;
$$;

-- provider: one load with its offers
create or replace function public.provider_get_load(p_share text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_l public.freight_listings; v_company public.companies;
begin
  select * into v_l from public.freight_listings where share_token = p_share;
  if not found then return jsonb_build_object('error', 'LINK_INVALID'); end if;
  select * into v_company from public.companies where id = v_l.company_id;
  return jsonb_build_object(
    'load', jsonb_build_object('code', v_l.code, 'status', v_l.status, 'goods', v_l.goods_type, 'note', v_l.description,
      'shipperName', v_l.shipper_name, 'shipperPhone', v_l.shipper_phone,
      'pickupName', v_l.pickup_name, 'pickupLat', v_l.pickup_lat, 'pickupLng', v_l.pickup_lng,
      'dropName', v_l.drop_name, 'dropLat', v_l.drop_lat, 'dropLng', v_l.drop_lng,
      'lengthCm', v_l.length_cm, 'widthCm', v_l.width_cm, 'heightCm', v_l.height_cm, 'weightKg', v_l.weight_kg,
      'quantity', v_l.quantity, 'fragile', v_l.fragile, 'priceInr', v_l.offered_rate_inr,
      'readyFrom', v_l.ready_from, 'deliverBy', v_l.deliver_by, 'createdAt', v_l.created_at),
    'sharedBy', jsonb_build_object('name', v_company.name, 'phone', v_company.phone),
    'offers', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'amount', o.amount_inr, 'note', o.note, 'status', o.status,
                                                           'company', c.name, 'phone', c.phone, 'at', o.created_at) order by o.created_at desc)
                        from public.listing_offers o join public.companies c on c.id = o.company_id
                        where o.listing_id = v_l.id and o.status <> 'withdrawn'), '[]'::jsonb));
end;
$$;

-- provider: change the load while it is open
create or replace function public.provider_update_load(p_share text, p_load jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_l public.freight_listings;
begin
  select * into v_l from public.freight_listings where share_token = p_share;
  if not found then return jsonb_build_object('error', 'LINK_INVALID'); end if;
  if v_l.status <> 'open' then return jsonb_build_object('error', 'LISTING_NOT_OPEN'); end if;
  perform public._provider_load_fields(p_load);
  update public.freight_listings set goods_type = trim(p_load ->> 'goods'), description = left(coalesce(p_load ->> 'note', ''), 200),
    pickup_name = p_load ->> 'pickupName', pickup_lat = (p_load ->> 'pickupLat')::float8, pickup_lng = (p_load ->> 'pickupLng')::float8,
    drop_name = p_load ->> 'dropName', drop_lat = (p_load ->> 'dropLat')::float8, drop_lng = (p_load ->> 'dropLng')::float8,
    length_cm = (p_load ->> 'lengthCm')::numeric, width_cm = (p_load ->> 'widthCm')::numeric, height_cm = (p_load ->> 'heightCm')::numeric,
    weight_kg = (p_load ->> 'weightKg')::numeric, quantity = (p_load ->> 'quantity')::int,
    fragile = coalesce((p_load ->> 'fragile')::boolean, false), stackable = not coalesce((p_load ->> 'fragile')::boolean, false),
    offered_rate_inr = round((p_load ->> 'priceInr')::numeric),
    ready_from = coalesce(nullif(p_load ->> 'readyFrom', '')::timestamptz, ready_from),
    deliver_by = nullif(p_load ->> 'deliverBy', '')::timestamptz
  where id = v_l.id;
  return jsonb_build_object('ok', true);
end;
$$;

-- provider: take the load off (only while nobody has it)
create or replace function public.provider_cancel_load(p_share text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  update public.freight_listings set status = 'expired' where share_token = p_share and status in ('open', 'reserved');
  if not found then return jsonb_build_object('error', 'LISTING_NOT_OPEN'); end if;
  update public.listing_offers set status = 'rejected', answered_at = now()
   where listing_id = (select id from public.freight_listings where share_token = p_share) and status = 'pending';
  return jsonb_build_object('ok', true);
end;
$$;

-- provider: accept or turn down a counter-offer. Accepting sets the price, keeps the load for that owner
-- (reserved) and turns down the other pending offers.
create or replace function public.provider_answer_offer(p_share text, p_offer_id uuid, p_accept boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_l public.freight_listings; v_o public.listing_offers;
begin
  select * into v_l from public.freight_listings where share_token = p_share;
  if not found then return jsonb_build_object('error', 'LINK_INVALID'); end if;
  select * into v_o from public.listing_offers where id = p_offer_id and listing_id = v_l.id and status = 'pending';
  if not found then return jsonb_build_object('error', 'BAD_ITEMS'); end if;
  if p_accept and v_l.status <> 'open' then return jsonb_build_object('error', 'LISTING_NOT_OPEN'); end if;
  update public.listing_offers set status = case when p_accept then 'accepted' else 'rejected' end, answered_at = now() where id = v_o.id;
  if p_accept then
    update public.freight_listings set offered_rate_inr = v_o.amount_inr, status = 'reserved', accepted_by_company = v_o.company_id
     where id = v_l.id;
    update public.listing_offers set status = 'rejected', answered_at = now()
     where listing_id = v_l.id and id <> v_o.id and status = 'pending';
  end if;
  insert into public.alerts (company_id, kind, severity, title, message, meta)
  values (v_o.company_id, 'offer_answer', case when p_accept then 'info' else 'warning' end,
          case when p_accept then 'Offer accepted' else 'Offer turned down' end,
          v_l.code || ': ₹' || round(v_o.amount_inr),
          jsonb_build_object('code', v_l.code, 'amount', round(v_o.amount_inr), 'accepted', p_accept));
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.provider_link_info(text) from public;
revoke all on function public.provider_post_loads(text, jsonb, jsonb) from public;
revoke all on function public.provider_get_load(text) from public;
revoke all on function public.provider_update_load(text, jsonb) from public;
revoke all on function public.provider_cancel_load(text) from public;
revoke all on function public.provider_answer_offer(text, uuid, boolean) from public;
revoke all on function public._provider_load_fields(jsonb) from public, anon, authenticated;
grant execute on function public.provider_link_info(text) to anon, authenticated;
grant execute on function public.provider_post_loads(text, jsonb, jsonb) to anon, authenticated;
grant execute on function public.provider_get_load(text) to anon, authenticated;
grant execute on function public.provider_update_load(text, jsonb) to anon, authenticated;
grant execute on function public.provider_cancel_load(text) to anon, authenticated;
grant execute on function public.provider_answer_offer(text, uuid, boolean) to anon, authenticated;
