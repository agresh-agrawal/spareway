-- Trader / shipper portal (owner request): the provider link asks once "Trader or shipper?" + name + mobile and
-- gives that person their own private page (/my-loads/:portal) to upload loads and see all of them with offers.
-- Also 18 more sample loads (only for the sample-data accounts). Additive file; applied with the Supabase MCP.

create table if not exists public.providers (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  link_id       uuid references public.provider_links (id) on delete set null,
  kind          text not null check (kind in ('trader', 'shipper')),
  name          text not null,
  phone         text not null,
  portal_token  text not null unique,
  is_sample     boolean not null default false,
  created_at    timestamptz not null default now(),
  constraint providers_company_phone_unique unique (company_id, phone)
);
alter table public.providers enable row level security;
drop policy if exists providers_own_company on public.providers;
create policy providers_own_company on public.providers for select to authenticated
  using (company_id = public.current_company_id());

alter table public.freight_listings
  add column if not exists provider_id uuid references public.providers (id) on delete set null;

-- digits only, last 10 (so "+91 98270 11111" and "9827011111" are the same person)
create or replace function public._phone_key(p text)
returns text language sql immutable as $$ select right(regexp_replace(coalesce(p, ''), '\D', '', 'g'), 10) $$;

-- the shared link: who are you? → your own portal token (same mobile = same portal)
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
  insert into public.providers (company_id, link_id, kind, name, phone, portal_token)
  values (v_link.company_id, v_link.id, p_kind, v_name, v_key, encode(gen_random_bytes(16), 'hex'))
  on conflict (company_id, phone) do update set kind = excluded.kind, name = excluded.name, link_id = excluded.link_id
  returning portal_token into v_portal;
  return jsonb_build_object('portalToken', v_portal);
end;
$$;

-- the provider's own page: who, for which transporter, and every load with its offers
create or replace function public.provider_portal(p_portal text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_p public.providers; v_c public.companies;
begin
  select * into v_p from public.providers where portal_token = p_portal;
  if not found then return jsonb_build_object('error', 'LINK_INVALID'); end if;
  select * into v_c from public.companies where id = v_p.company_id;
  return jsonb_build_object(
    'provider', jsonb_build_object('kind', v_p.kind, 'name', v_p.name, 'phone', v_p.phone),
    'company', jsonb_build_object('name', v_c.name, 'phone', v_c.phone),
    'loads', coalesce((select jsonb_agg(jsonb_build_object(
        'code', f.code, 'status', f.status, 'goods', f.goods_type, 'pickupName', f.pickup_name, 'dropName', f.drop_name,
        'quantity', f.quantity, 'weightKg', f.weight_kg, 'priceInr', f.offered_rate_inr, 'readyFrom', f.ready_from,
        'deliverBy', f.deliver_by, 'shareToken', f.share_token, 'createdAt', f.created_at,
        'offersWaiting', (select count(*) from public.listing_offers o where o.listing_id = f.id and o.status = 'pending'),
        'bestOffer', (select max(o.amount_inr) from public.listing_offers o where o.listing_id = f.id and o.status = 'pending'))
      order by f.created_at desc)
      from public.freight_listings f where f.provider_id = v_p.id), '[]'::jsonb));
end;
$$;

-- upload one or more loads from the portal (same checks as provider_post_loads)
create or replace function public.provider_portal_post(p_portal text, p_loads jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_p public.providers; v_load jsonb; v_code text; v_share text; v_out jsonb := '[]'::jsonb;
begin
  select * into v_p from public.providers where portal_token = p_portal;
  if not found then return jsonb_build_object('error', 'LINK_INVALID'); end if;
  if jsonb_typeof(p_loads) <> 'array' or jsonb_array_length(p_loads) not between 1 and 10 then return jsonb_build_object('error', 'BAD_ITEMS'); end if;
  for v_load in select * from jsonb_array_elements(p_loads) loop
    perform public._provider_load_fields(v_load);
    select 'LD-' || lpad((coalesce(max(nullif(split_part(code, '-', 2), '')::int), 2000) + 1)::text, 4, '0') into v_code
      from public.freight_listings where company_id = v_p.company_id and code ~ '^LD-[0-9]+$';
    v_share := encode(gen_random_bytes(12), 'hex');
    insert into public.freight_listings (company_id, code, visibility, shipper_name, shipper_phone, goods_type, description,
      pickup_name, pickup_lat, pickup_lng, drop_name, drop_lat, drop_lng, length_cm, width_cm, height_cm, weight_kg, quantity,
      fragile, upright_only, stackable, offered_rate_inr, ready_from, deliver_by, status, share_token, provider_link_id, provider_id)
    values (v_p.company_id, v_code, 'public', v_p.name, v_p.phone, trim(v_load ->> 'goods'), left(coalesce(v_load ->> 'note', ''), 200),
      v_load ->> 'pickupName', (v_load ->> 'pickupLat')::float8, (v_load ->> 'pickupLng')::float8,
      v_load ->> 'dropName', (v_load ->> 'dropLat')::float8, (v_load ->> 'dropLng')::float8,
      (v_load ->> 'lengthCm')::numeric, (v_load ->> 'widthCm')::numeric, (v_load ->> 'heightCm')::numeric,
      (v_load ->> 'weightKg')::numeric, (v_load ->> 'quantity')::int,
      coalesce((v_load ->> 'fragile')::boolean, false), false, not coalesce((v_load ->> 'fragile')::boolean, false),
      round((v_load ->> 'priceInr')::numeric), coalesce(nullif(v_load ->> 'readyFrom', '')::timestamptz, now()),
      nullif(v_load ->> 'deliverBy', '')::timestamptz, 'open', v_share, v_p.link_id, v_p.id);
    v_out := v_out || jsonb_build_object('code', v_code, 'shareToken', v_share);
  end loop;
  insert into public.alerts (company_id, kind, severity, title, message, meta)
  values (v_p.company_id, 'provider_load', 'info', 'New loads from a provider',
          v_p.name || ' posted ' || jsonb_array_length(p_loads) || ' load(s)',
          jsonb_build_object('name', v_p.name, 'count', jsonb_array_length(p_loads)));
  return jsonb_build_object('ok', true, 'loads', v_out);
end;
$$;

revoke all on function public.provider_join(text, text, text, text) from public;
revoke all on function public.provider_portal(text) from public;
revoke all on function public.provider_portal_post(text, jsonb) from public;
grant execute on function public.provider_join(text, text, text, text) to anon, authenticated;
grant execute on function public.provider_portal(text) to anon, authenticated;
grant execute on function public.provider_portal_post(text, jsonb) to anon, authenticated;

-- ---------- more sample loads (sample-data accounts only) ----------
create or replace function public._seed_more_loads(p_company uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare v_trader uuid; v_shipper uuid;
begin
  delete from public.freight_listings where company_id = p_company and is_sample and code ~ '^LD-11[0-9][0-9]$';
  delete from public.providers where company_id = p_company and is_sample;
  insert into public.providers (company_id, kind, name, phone, portal_token, is_sample)
  values (p_company, 'trader', 'Sharma Trading Co.', '9827011101', encode(gen_random_bytes(16), 'hex'), true)
  returning id into v_trader;
  insert into public.providers (company_id, kind, name, phone, portal_token, is_sample)
  values (p_company, 'shipper', 'Patel Industries', '9825011102', encode(gen_random_bytes(16), 'hex'), true)
  returning id into v_shipper;

  insert into public.freight_listings (company_id, visibility, code, shipper_name, shipper_phone, goods_type, description,
    pickup_name, pickup_lat, pickup_lng, drop_name, drop_lat, drop_lng, length_cm, width_cm, height_cm, weight_kg, quantity,
    fragile, upright_only, stackable, offered_rate_inr, ready_from, deliver_by, status, is_sample, share_token, provider_id)
  select p_company, 'company', v.code, v.shipper, v.phone, v.goods, v.note,
         v.pn, v.plat, v.plng, v.dn, v.dlat, v.dlng, v.l, v.w, v.h, v.kg, v.qty, v.fragile, false, not v.fragile,
         v.rate, now() + make_interval(days => v.ready), now() + make_interval(days => v.ready + v.days), 'open', true,
         encode(gen_random_bytes(12), 'hex'),
         case v.who when 't' then v_trader when 's' then v_shipper end
  from (values
    ('LD-1101','Sharma Trading Co.','+91 98270 11101','Soap cartons','For a distributor in Pune','Indore',22.7196,75.8577,'Pune',18.5204,73.8567,60,40,40,14.0,60,false,12500,0,3,'t'),
    ('LD-1102','Sharma Trading Co.','+91 98270 11101','Cooking oil tins','15 L tins, keep upright','Indore',22.7196,75.8577,'Mumbai (Bhiwandi)',19.2813,73.0483,30,30,40,16.0,120,false,15800,1,3,'t'),
    ('LD-1103','Sharma Trading Co.','+91 98270 11101','Rice bags','25 kg bags','Kota',25.2138,75.8648,'Ahmedabad (Narol)',22.9536,72.5947,70,45,15,25.0,80,false,9800,1,4,'t'),
    ('LD-1104','Patel Industries','+91 98250 11102','Machine parts','Wooden crates, forklift at both ends','Ahmedabad (Aslali)',22.9196,72.5996,'Pune (Chakan)',18.7606,73.8636,120,80,90,320.0,4,false,18500,0,3,'s'),
    ('LD-1105','Patel Industries','+91 98250 11102','PVC pipes','6 m pipes, light','Vadodara (Makarpura)',22.2587,73.1902,'Nashik',19.9975,73.7898,600,30,30,40.0,15,false,8900,2,3,'s'),
    ('LD-1106','Patel Industries','+91 98250 11102','Electric motors','Fragile, do not stack','Rajkot',22.3039,70.8022,'Mumbai (Bhiwandi)',19.2813,73.0483,60,50,50,45.0,20,true,14200,1,3,'s'),
    ('LD-1107','Jain Textiles','+91 98290 11107','Cloth bales','Pressed bales','Bhilwara',25.347,74.641,'Surat (Sachin GIDC)',21.085,72.882,100,60,60,90.0,25,false,13500,0,4,null),
    ('LD-1108','Gupta Electricals','+91 98110 11108','Ceiling fans','Boxed, fragile','Delhi',28.6139,77.209,'Jaipur (VKIA)',26.967,75.77,80,30,30,7.0,150,true,9500,1,2,null),
    ('LD-1109','Agarwal Paper Mart','+91 98260 11109','Paper reels','Keep dry','Pithampur',22.6139,75.6789,'Ahmedabad (Narol)',22.9536,72.5947,110,110,100,450.0,3,false,11800,0,3,null),
    ('LD-1110','Khan Ceramics','+91 98250 11110','Floor tiles','Boxes on pallets, fragile','Ahmedabad (Aslali)',22.9196,72.5996,'Jaipur (Sitapura)',26.7787,75.8306,120,100,80,900.0,2,true,15500,2,4,null),
    ('LD-1111','Mehta Pharma','+91 98200 11111','Medicine cartons','Keep upright, fragile','Mumbai (Bhiwandi)',19.2813,73.0483,'Vadodara',22.3072,73.1812,50,40,40,12.0,40,true,7200,0,2,null),
    ('LD-1112','Singh Auto Parts','+91 98140 11112','Tyres','Truck tyres','Gurugram',28.4595,77.0266,'Jaipur (Sitapura)',26.7787,75.8306,110,110,30,55.0,24,false,8200,1,2,null),
    ('LD-1113','Reddy Foods','+91 98480 11113','Biscuit cartons','Light, keep dry','Indore',22.7196,75.8577,'Surat (Kamrej)',21.2706,72.959,55,40,35,8.0,100,false,9900,0,3,null),
    ('LD-1114','Verma Steel','+91 98270 11114','Steel angles','Long, heavy','Indore',22.7196,75.8577,'Vadodara',22.3072,73.1812,500,20,20,120.0,15,false,11200,2,4,null),
    ('LD-1115','Joshi Furniture','+91 98290 11115','Office chairs','Boxed, do not stack heavy goods on top','Jaipur (Sitapura)',26.7787,75.8306,'Ahmedabad (Aslali)',22.9196,72.5996,70,70,110,18.0,30,true,10400,1,3,null),
    ('LD-1116','Desai Chemicals','+91 98250 11116','Paint drums','20 L drums, keep upright','Ankleshwar',21.6264,73.0152,'Pune',18.5204,73.8567,40,40,45,24.0,60,false,12800,0,3,null),
    ('LD-1117','Kapoor Electronics','+91 98100 11117','LED TVs','Very fragile','Noida',28.5355,77.391,'Ajmer',26.4499,74.6399,120,20,75,16.0,40,true,13900,1,3,null),
    ('LD-1118','Rathore Marble','+91 98290 11118','Marble slabs','Heavy, on A-frames','Kishangarh',26.59,74.854,'Mumbai (Bhiwandi)',19.2813,73.0483,240,20,160,600.0,6,true,32500,2,5,null)
  ) as v(code, shipper, phone, goods, note, pn, plat, plng, dn, dlat, dlng, l, w, h, kg, qty, fragile, rate, ready, days, who);

  -- one counter-offer waiting on the trader's first load, so the portal shows how offers look
  insert into public.listing_offers (listing_id, company_id, amount_inr, note)
  select id, p_company, 13800, 'Can pick up tomorrow morning' from public.freight_listings
   where company_id = p_company and code = 'LD-1101' and is_sample;
end;
$$;
revoke all on function public._seed_more_loads(uuid) from public, anon, authenticated;

-- seed / reset also add the extra loads (patched in place so the rest of each function stays as it is)
do $$
declare f text;
begin
  foreach f in array array['public.seed_sample_data()', 'public.reset_sample_data()'] loop
    if position('_seed_more_loads' in pg_get_functiondef(f::regprocedure)) = 0 then
      execute replace(pg_get_functiondef(f::regprocedure), 'perform public._seed_company(v_c);',
                      'perform public._seed_company(v_c); perform public._seed_more_loads(v_c);');
    end if;
  end loop;
end $$;

-- add them now for the three sample-data accounts
do $$
declare c uuid;
begin
  for c in select p.company_id from public.profiles p join auth.users u on u.id = p.id
            where lower(u.email) in ('agresh@agreshagrawal.com', 'qa.owner@spareway.test', 'qa.owner2@spareway.test')
  loop
    perform public._seed_more_loads(c);
  end loop;
end $$;
