-- Pre-Phase 4 (owner requests): the driver belongs to the trip, not the truck; challan corner (trip costs such as
-- challans, breakdowns, police, parking) counted in the trip's net earnings; the driver link can report a challan
-- and mark a stop reached / delivered. Additive file; applied with the Supabase MCP.

-- 1. driver on the trip (the truck keeps the latest driver so the fleet list still shows who drives it now)
alter table public.trips
  add column if not exists driver_name  text not null default '',
  add column if not exists driver_phone text not null default '';

update public.trips t set driver_name = k.driver_name, driver_phone = k.driver_phone
  from public.trucks k where k.id = t.truck_id and t.driver_name = '' and k.driver_name <> '';

drop function if exists public.create_trip_with_stops(uuid, timestamptz, numeric, jsonb);
create or replace function public.create_trip_with_stops(
  p_truck_id uuid,
  p_planned_departure timestamptz,
  p_base_freight_inr numeric,
  p_stops jsonb,
  p_driver_name text default '',
  p_driver_phone text default ''
)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_trip uuid;
  v_code text;
  v_stop jsonb;
  v_seq int := 0;
  v_name text := left(trim(coalesce(p_driver_name, '')), 60);
  v_phone text := left(trim(coalesce(p_driver_phone, '')), 20);
begin
  if public.current_company_id() is null then raise exception 'NOT_SIGNED_IN'; end if;
  if not exists (select 1 from public.trucks where id = p_truck_id) then raise exception 'TRUCK_NOT_FOUND'; end if;
  if jsonb_typeof(p_stops) <> 'array' or jsonb_array_length(p_stops) < 2 then raise exception 'BAD_STOPS'; end if;
  if p_stops -> 0 ->> 'stop_type' <> 'origin' then raise exception 'BAD_STOPS'; end if;
  if v_phone !~ '^[+0-9 -]*$' then raise exception 'BAD_PHONE'; end if;

  v_code := public.next_trip_code();
  insert into public.trips (code, truck_id, status, planned_departure, base_freight_inr, driver_name, driver_phone)
  values (v_code, p_truck_id, 'planned', p_planned_departure, coalesce(p_base_freight_inr, 0), v_name, v_phone)
  returning id into v_trip;

  for v_stop in select * from jsonb_array_elements(p_stops) loop
    if v_seq > 0 and v_stop ->> 'stop_type' not in ('drop', 'pickup') then raise exception 'BAD_STOPS'; end if;
    insert into public.trip_stops (trip_id, seq, stop_type, name, city, lat, lng, window_start, window_end)
    values (v_trip, v_seq, v_stop ->> 'stop_type', v_stop ->> 'name', coalesce(v_stop ->> 'city', ''),
            (v_stop ->> 'lat')::double precision, (v_stop ->> 'lng')::double precision,
            nullif(v_stop ->> 'window_start', '')::timestamptz, nullif(v_stop ->> 'window_end', '')::timestamptz);
    v_seq := v_seq + 1;
  end loop;

  if v_name <> '' then
    update public.trucks set driver_name = v_name, driver_phone = v_phone where id = p_truck_id;
  end if;

  insert into public.activity_log (kind, message, entity_type, entity_ref, meta)
  values ('trip_created', 'New trip ' || v_code, 'trip', v_code, jsonb_build_object('code', v_code));

  return jsonb_build_object('id', v_trip, 'code', v_code);
end;
$$;
revoke execute on function public.create_trip_with_stops(uuid, timestamptz, numeric, jsonb, text, text) from public, anon;
grant execute on function public.create_trip_with_stops(uuid, timestamptz, numeric, jsonb, text, text) to authenticated;

-- 2. challan corner: trip costs outside the route cost
create table if not exists public.trip_expenses (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null default public.current_company_id() references public.companies (id) on delete cascade,
  trip_id     uuid not null references public.trips (id) on delete cascade,
  kind        text not null check (kind in ('challan', 'breakdown', 'police', 'parking', 'loading', 'other')),
  amount_inr  numeric not null check (amount_inr >= 0 and amount_inr <= 1000000),
  note        text not null default '',
  added_by    text not null default 'owner' check (added_by in ('owner', 'driver')),
  created_at  timestamptz not null default now()
);
create index if not exists trip_expenses_trip_idx on public.trip_expenses (trip_id);
alter table public.trip_expenses enable row level security;
drop policy if exists trip_expenses_own_company on public.trip_expenses;
create policy trip_expenses_own_company on public.trip_expenses for all to authenticated
  using (company_id = public.current_company_id()) with check (company_id = public.current_company_id());

-- owner notifications from the driver link
alter table public.alerts drop constraint if exists alerts_kind_check;
alter table public.alerts add constraint alerts_kind_check
  check (kind in ('loader_issue', 'loader_cargo', 'driver_challan', 'driver_stop'));

-- net earnings now also take off the trip costs (columns appended at the end)
create or replace view public.trip_financials with (security_invoker = true) as
select
  t.id as trip_id, t.company_id, t.code, t.status, t.planned_departure, t.base_freight_inr,
  coalesce(x.extra_revenue, 0)       as extra_revenue_inr,
  coalesce(x.extra_cost, 0)          as extra_cost_inr,
  coalesce(ro.total_cost_inr, 0)     as route_cost_inr,
  coalesce(ro.distance_km, 0)        as distance_km,
  t.base_freight_inr + coalesce(x.extra_revenue, 0) - coalesce(ro.total_cost_inr, 0) - coalesce(x.extra_cost, 0)
    - coalesce(m.misc, 0)            as net_earnings_inr,
  coalesce(m.misc, 0)                as misc_cost_inr,
  coalesce(m.challans, 0)            as challan_cost_inr,
  t.completed_at,
  t.driver_name
from public.trips t
left join public.route_options ro on ro.id = t.selected_route_id
left join lateral (
  select sum(f.offered_rate_inr) as extra_revenue, sum(e.incremental_cost_inr) as extra_cost
  from public.trip_extra_loads e
  join public.freight_listings f on f.id = e.listing_id
  where e.trip_id = t.id and e.status = 'accepted'
) x on true
left join lateral (
  select sum(amount_inr) as misc, sum(amount_inr) filter (where kind = 'challan') as challans
  from public.trip_expenses where trip_id = t.id
) m on true;

-- 3. driver link: report a challan / cost, mark a stop
create or replace function public.driver_add_expense(p_token text, p_kind text, p_amount numeric, p_note text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_trip public.trips;
begin
  select * into v_trip from public.trips where driver_token = p_token and driver_link_enabled and status <> 'cancelled';
  if not found then return jsonb_build_object('error', 'LINK_INVALID'); end if;
  if p_kind not in ('challan', 'breakdown', 'police', 'parking', 'loading', 'other') then return jsonb_build_object('error', 'BAD_ITEMS'); end if;
  if p_amount is null or p_amount < 0 or p_amount > 1000000 then return jsonb_build_object('error', 'BAD_ITEMS'); end if;
  insert into public.trip_expenses (company_id, trip_id, kind, amount_inr, note, added_by)
  values (v_trip.company_id, v_trip.id, p_kind, round(p_amount), left(coalesce(p_note, ''), 200), 'driver');
  insert into public.alerts (company_id, trip_id, truck_id, kind, severity, title, message, meta)
  values (v_trip.company_id, v_trip.id, v_trip.truck_id, 'driver_challan', case when p_kind = 'challan' then 'warning' else 'info' end,
          'Driver reported a cost', v_trip.code || ': ' || p_kind || ' ₹' || round(p_amount) || coalesce(' — ' || nullif(p_note, ''), ''),
          jsonb_build_object('code', v_trip.code, 'kind', p_kind, 'amount', round(p_amount), 'note', coalesce(p_note, '')));
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.driver_mark_stop(p_token text, p_stop_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_trip public.trips; v_name text;
begin
  select * into v_trip from public.trips where driver_token = p_token and driver_link_enabled and status <> 'cancelled';
  if not found then return jsonb_build_object('error', 'LINK_INVALID'); end if;
  if p_status not in ('arrived', 'done') then return jsonb_build_object('error', 'BAD_ITEMS'); end if;
  update public.trip_stops set status = p_status where id = p_stop_id and trip_id = v_trip.id and stop_type <> 'origin'
    returning name into v_name;
  if not found then return jsonb_build_object('error', 'BAD_ITEMS'); end if;
  insert into public.alerts (company_id, trip_id, truck_id, kind, severity, title, message, meta)
  values (v_trip.company_id, v_trip.id, v_trip.truck_id, 'driver_stop', 'info',
          case when p_status = 'done' then 'Driver delivered' else 'Driver reached a stop' end,
          v_trip.code || ': ' || v_name, jsonb_build_object('code', v_trip.code, 'stop', v_name, 'status', p_status));
  return jsonb_build_object('ok', true);
end;
$$;

-- driver page: the trip's own driver, payload vs cargo (overload warning) and the costs the driver reported
create or replace function public.driver_get_trip(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_trip public.trips;
  v_truck public.trucks;
  v_company public.companies;
  v_route public.route_options;
begin
  select * into v_trip from public.trips
   where driver_token = p_token and driver_link_enabled and status <> 'cancelled';
  if not found then return jsonb_build_object('error', 'LINK_INVALID'); end if;
  select * into v_truck from public.trucks where id = v_trip.truck_id;
  select * into v_company from public.companies where id = v_trip.company_id;
  select * into v_route from public.route_options where id = v_trip.selected_route_id;

  return jsonb_build_object(
    'trip', jsonb_build_object('code', v_trip.code, 'status', v_trip.status,
                               'departure', coalesce(v_trip.actual_departure, v_trip.planned_departure)),
    'company', jsonb_build_object('name', v_company.name, 'phone', v_company.phone),
    'truck', jsonb_build_object('regNo', v_truck.reg_no, 'model', v_truck.model,
                                'driverName', coalesce(nullif(v_trip.driver_name, ''), v_truck.driver_name),
                                'payloadKg', v_truck.payload_kg),
    'cargoKg', coalesce((select round(sum(c.quantity * c.weight_kg)) from public.cargo_items c where c.trip_id = v_trip.id), 0),
    'stops', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'seq', s.seq, 'type', s.stop_type, 'name', s.name,
                                                          'city', s.city, 'lat', s.lat, 'lng', s.lng, 'eta', s.eta,
                                                          'windowEnd', s.window_end, 'status', s.status) order by s.seq)
                       from public.trip_stops s where s.trip_id = v_trip.id), '[]'::jsonb),
    'drops', coalesce((select jsonb_agg(jsonb_build_object('stopId', d.drop_stop_id, 'lines', d.lines, 'pieces', d.pieces,
                                                          'kg', d.kg, 'fragile', d.fragile))
                       from (select c.drop_stop_id, count(*) lines, sum(c.quantity) pieces, round(sum(c.quantity * c.weight_kg)) kg,
                                    bool_or(c.fragile) fragile
                               from public.cargo_items c where c.trip_id = v_trip.id group by c.drop_stop_id) d), '[]'::jsonb),
    'expenses', coalesce((select jsonb_agg(jsonb_build_object('kind', e.kind, 'amount', e.amount_inr, 'note', e.note,
                                                             'at', e.created_at) order by e.created_at desc)
                          from public.trip_expenses e where e.trip_id = v_trip.id and e.added_by = 'driver'), '[]'::jsonb),
    'route', case when v_route.id is null then null else jsonb_build_object(
               'variant', v_route.variant, 'distanceKm', v_route.distance_km, 'durationMin', v_route.duration_min,
               'tollCount', v_route.toll_count, 'geometry', v_route.geometry, 'halts', v_route.halts,
               'warnings', v_route.warnings) end
  );
end;
$$;

revoke all on function public.driver_add_expense(text, text, numeric, text) from public;
revoke all on function public.driver_mark_stop(text, uuid, text) from public;
grant execute on function public.driver_add_expense(text, text, numeric, text) to anon, authenticated;
grant execute on function public.driver_mark_stop(text, uuid, text) to anon, authenticated;
