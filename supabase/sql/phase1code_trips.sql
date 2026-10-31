-- Phase 1·Code — create a trip and its ordered stops in one transaction (additive, re-runnable).
-- p_stops: [{ "stop_type": "origin"|"drop"|"pickup", "name", "city", "lat", "lng", "window_start"?, "window_end"? }, …]
-- in visiting order; the first must be the origin. RLS applies (security invoker): the truck must be the caller's.
create or replace function public.create_trip_with_stops(
  p_truck_id uuid,
  p_planned_departure timestamptz,
  p_base_freight_inr numeric,
  p_stops jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_trip uuid;
  v_code text;
  v_stop jsonb;
  v_seq int := 0;
begin
  if public.current_company_id() is null then raise exception 'NOT_SIGNED_IN'; end if;
  if not exists (select 1 from public.trucks where id = p_truck_id) then raise exception 'TRUCK_NOT_FOUND'; end if;
  if jsonb_typeof(p_stops) <> 'array' or jsonb_array_length(p_stops) < 2 then raise exception 'BAD_STOPS'; end if;
  if p_stops -> 0 ->> 'stop_type' <> 'origin' then raise exception 'BAD_STOPS'; end if;

  v_code := public.next_trip_code();
  insert into public.trips (code, truck_id, status, planned_departure, base_freight_inr)
  values (v_code, p_truck_id, 'planned', p_planned_departure, coalesce(p_base_freight_inr, 0))
  returning id into v_trip;

  for v_stop in select * from jsonb_array_elements(p_stops) loop
    if v_seq > 0 and v_stop ->> 'stop_type' not in ('drop', 'pickup') then raise exception 'BAD_STOPS'; end if;
    insert into public.trip_stops (trip_id, seq, stop_type, name, city, lat, lng, window_start, window_end)
    values (v_trip, v_seq, v_stop ->> 'stop_type', v_stop ->> 'name', coalesce(v_stop ->> 'city', ''),
            (v_stop ->> 'lat')::double precision, (v_stop ->> 'lng')::double precision,
            nullif(v_stop ->> 'window_start', '')::timestamptz, nullif(v_stop ->> 'window_end', '')::timestamptz);
    v_seq := v_seq + 1;
  end loop;

  insert into public.activity_log (kind, message, entity_type, entity_ref, meta)
  values ('trip_created', 'New trip ' || v_code, 'trip', v_code, jsonb_build_object('code', v_code));

  return jsonb_build_object('id', v_trip, 'code', v_code);
end;
$$;

revoke execute on function public.create_trip_with_stops(uuid, timestamptz, numeric, jsonb) from public, anon;
grant execute on function public.create_trip_with_stops(uuid, timestamptz, numeric, jsonb) to authenticated;
