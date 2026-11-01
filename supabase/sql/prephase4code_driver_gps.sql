-- Real GPS from the driver's phone (roadmap item 3). The driver taps "Share my location" on the driver link
-- (the phone asks for permission); the page sends the position about once a minute while open. The owner's map
-- uses it instead of the simulated position when it is fresh, and shows accuracy and "updated N min ago".
-- Additive file; applied with the Supabase MCP.

alter table public.trips
  add column if not exists gps_lat double precision,
  add column if not exists gps_lng double precision,
  add column if not exists gps_accuracy_m numeric,
  add column if not exists gps_speed_kmph numeric,
  add column if not exists gps_at timestamptz;

create or replace function public.driver_send_location(p_token text, p_lat double precision, p_lng double precision,
                                                       p_accuracy_m numeric default null, p_speed_kmph numeric default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_trip public.trips;
begin
  select * into v_trip from public.trips
   where driver_token = p_token and driver_link_enabled and status in ('planned', 'loading', 'in_transit');
  if not found then return jsonb_build_object('error', 'LINK_INVALID'); end if;
  -- India box only; ignore nonsense
  if p_lat is null or p_lng is null or p_lat not between 6 and 38 or p_lng not between 67 and 98 then
    return jsonb_build_object('error', 'BAD_ITEMS');
  end if;
  -- at most one point every 20 s
  if v_trip.gps_at is not null and v_trip.gps_at > now() - interval '20 seconds' then
    return jsonb_build_object('ok', true, 'skipped', true);
  end if;
  update public.trips
     set gps_lat = p_lat, gps_lng = p_lng,
         gps_accuracy_m = case when p_accuracy_m between 0 and 100000 then round(p_accuracy_m) end,
         gps_speed_kmph = case when p_speed_kmph between 0 and 200 then round(p_speed_kmph) end,
         gps_at = now()
   where id = v_trip.id;
  update public.trucks set last_lat = p_lat, last_lng = p_lng where id = v_trip.truck_id;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.driver_send_location(text, double precision, double precision, numeric, numeric) from public;
grant execute on function public.driver_send_location(text, double precision, double precision, numeric, numeric) to anon, authenticated;
