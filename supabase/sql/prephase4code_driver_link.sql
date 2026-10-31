-- Driver link (Pre-Phase 4): the owner shares a link / QR by WhatsApp; the driver opens it with no login and sees
-- the chosen route on a map, the stops with times, what to drop where, and how to call the owner. Read-only.
-- Additive file; applied with the Supabase MCP.

alter table public.trips
  add column if not exists driver_token text unique,
  add column if not exists driver_link_enabled boolean not null default false;

-- owner (RLS): new link for a trip, replaces the old one
create or replace function public.create_driver_link(p_trip_id uuid)
returns jsonb language plpgsql set search_path = public, extensions as $$
declare v_token text := encode(gen_random_bytes(18), 'hex');
begin
  update public.trips set driver_token = v_token, driver_link_enabled = true where id = p_trip_id;
  if not found then raise exception 'TRIP_NOT_FOUND'; end if;
  return jsonb_build_object('token', v_token);
end;
$$;

create or replace function public.disable_driver_link(p_trip_id uuid)
returns void language plpgsql set search_path = public as $$
begin
  update public.trips set driver_link_enabled = false where id = p_trip_id;
  if not found then raise exception 'TRIP_NOT_FOUND'; end if;
end;
$$;

-- driver (no login): everything the driver needs, nothing else
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
    'truck', jsonb_build_object('regNo', v_truck.reg_no, 'model', v_truck.model, 'driverName', v_truck.driver_name),
    'stops', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'seq', s.seq, 'type', s.stop_type, 'name', s.name,
                                                          'city', s.city, 'lat', s.lat, 'lng', s.lng, 'eta', s.eta,
                                                          'windowEnd', s.window_end, 'status', s.status) order by s.seq)
                       from public.trip_stops s where s.trip_id = v_trip.id), '[]'::jsonb),
    'drops', coalesce((select jsonb_agg(jsonb_build_object('stopId', d.drop_stop_id, 'lines', d.lines, 'pieces', d.pieces,
                                                          'kg', d.kg, 'fragile', d.fragile))
                       from (select c.drop_stop_id, count(*) lines, sum(c.quantity) pieces, round(sum(c.quantity * c.weight_kg)) kg,
                                    bool_or(c.fragile) fragile
                               from public.cargo_items c where c.trip_id = v_trip.id group by c.drop_stop_id) d), '[]'::jsonb),
    'route', case when v_route.id is null then null else jsonb_build_object(
               'variant', v_route.variant, 'distanceKm', v_route.distance_km, 'durationMin', v_route.duration_min,
               'tollCount', v_route.toll_count, 'geometry', v_route.geometry, 'halts', v_route.halts,
               'warnings', v_route.warnings) end
  );
end;
$$;

revoke all on function public.create_driver_link(uuid) from public, anon;
revoke all on function public.disable_driver_link(uuid) from public, anon;
grant execute on function public.create_driver_link(uuid) to authenticated;
grant execute on function public.disable_driver_link(uuid) to authenticated;
revoke all on function public.driver_get_trip(text) from public;
grant execute on function public.driver_get_trip(text) to anon, authenticated;
