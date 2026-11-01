-- Richer sample data for the demo (owner, 2026-11-01). Additive; applied with the Supabase MCP.
-- On top of _seed_company + _seed_more_loads: a month of finished trips on real corridors (route, km, costs, driver,
-- a few challans / parking / loading costs), a trip being loaded now, a chosen route for the live and the finished
-- sample trip, and a weighbridge slip that matches. All rows are is_sample (trips) so "Reset sample data" removes them.

create or replace function public._seed_demo_extras(p_company uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  diesel numeric := coalesce((select diesel_price_inr_per_l from public.company_settings where company_id = p_company), 96.5);
  r record;
  v_trip uuid; v_o uuid; v_d uuid; v_mid uuid; v_route uuid; v_truck public.trucks;
  fuel numeric;
begin
  -- finished trips: code, truck, days ago, hours driven, km, tolls, freight, origin, (mid), drop, cargo, driver
  for r in
    select * from (values
      ('TRP-2026-0021', 'MP09 KR 1147', 24, 9.5, 400, 1450, 24000, 'Indore (Sanwer Rd)', 22.7196, 75.8577, null::text, null::float8, null::float8, 'Ahmedabad (Narol)', 22.9536, 72.5947, 'Soybean oil tins (15 L)', 30, 25, 33, 15, 260, 'Mahesh Chouhan', '+91 98260 00005'),
      ('TRP-2026-0022', 'RJ14 GC 7735', 21, 6.5, 280, 1200, 19500, 'Jaipur (VKIA)', 26.9670, 75.7700, null, null, null, 'Delhi (Okhla)', 28.5355, 77.2750, 'Cotton bedsheet bales', 90, 60, 50, 45, 90, 'Suresh Meena', '+91 98290 00002'),
      ('TRP-2026-0023', 'GJ01 KT 2208', 17, 11.0, 525, 2300, 32000, 'Ahmedabad (Aslali)', 22.9196, 72.5996, 'Vadodara (Makarpura)', 22.2587, 73.1902, 'Mumbai (Bhiwandi)', 19.2813, 73.0483, 'Pharma cartons', 60, 40, 40, 12, 300, 'Vikram Patel', '+91 98250 00003'),
      ('TRP-2026-0024', 'MP09 HG 4821', 13, 13.5, 650, 2900, 41000, 'Manesar warehouse', 28.3540, 76.9366, 'Jaipur (Sitapura)', 26.7787, 75.8306, 'Udaipur', 24.5854, 73.7125, 'Ceiling fan (carton of 4)', 60, 40, 45, 18, 280, 'Ramesh Yadav', '+91 98270 00001'),
      ('TRP-2026-0025', 'MH04 LQ 9913', 9, 4.5, 170, 650, 14500, 'Mumbai (Bhiwandi)', 19.2813, 73.0483, null, null, null, 'Pune (Chakan)', 18.7606, 73.8636, 'Auto parts (brake assemblies)', 80, 60, 60, 45, 120, 'Anil Pawar', '+91 98200 00004'),
      ('TRP-2026-0026', 'GJ01 KT 2208', 6, 10.0, 470, 1500, 26000, 'Surat (Sachin GIDC)', 21.0850, 72.8820, null, null, null, 'Indore (Sanwer Rd)', 22.7196, 75.8577, 'Fabric rolls', 150, 40, 40, 35, 90, 'Vikram Patel', '+91 98250 00003'),
      ('TRP-2026-0027', 'RJ14 TB 3360', 4, 13.0, 660, 2700, 36000, 'Jaipur (VKIA)', 26.9670, 75.7700, 'Udaipur', 24.5854, 73.7125, 'Ahmedabad (Narol)', 22.9536, 72.5947, 'Marble tiles crate', 120, 60, 40, 180, 28, 'Imran Khan', '+91 98290 00006')
    ) as v(code, reg, days, hours, km, tolls, freight, o_name, o_lat, o_lng, m_name, m_lat, m_lng, d_name, d_lat, d_lng,
           label, l, w, h, kg, qty, driver, phone)
  loop
    select * into v_truck from public.trucks where company_id = p_company and reg_no = r.reg;
    if not found then continue; end if;
    insert into public.trips (company_id, code, truck_id, status, planned_departure, actual_departure, completed_at,
                              base_freight_inr, driver_name, driver_phone, is_sample)
    values (p_company, r.code, v_truck.id, 'completed', now() - make_interval(days => r.days),
            now() - make_interval(days => r.days), now() - make_interval(days => r.days) + make_interval(mins => (r.hours * 60)::int),
            r.freight, r.driver, r.phone, true)
    returning id into v_trip;
    insert into public.trip_stops (company_id, trip_id, seq, stop_type, name, city, lat, lng, status)
    values (p_company, v_trip, 0, 'origin', r.o_name, split_part(r.o_name, ' (', 1), r.o_lat, r.o_lng, 'done') returning id into v_o;
    if r.m_name is not null then
      insert into public.trip_stops (company_id, trip_id, seq, stop_type, name, city, lat, lng, status)
      values (p_company, v_trip, 1, 'drop', r.m_name, split_part(r.m_name, ' (', 1), r.m_lat, r.m_lng, 'done') returning id into v_mid;
    end if;
    insert into public.trip_stops (company_id, trip_id, seq, stop_type, name, city, lat, lng, status)
    values (p_company, v_trip, case when r.m_name is null then 1 else 2 end, 'drop', r.d_name, split_part(r.d_name, ' (', 1), r.d_lat, r.d_lng, 'done')
    returning id into v_d;
    insert into public.cargo_items (company_id, trip_id, label, client_name, length_cm, width_cm, height_cm, weight_kg, quantity, drop_stop_id, source)
    values (p_company, v_trip, r.label, '', r.l, r.w, r.h, r.kg, case when r.m_name is null then r.qty else r.qty / 2 end, v_d, 'seed');
    if r.m_name is not null then
      insert into public.cargo_items (company_id, trip_id, label, client_name, length_cm, width_cm, height_cm, weight_kg, quantity, drop_stop_id, source)
      values (p_company, v_trip, r.label, '', r.l, r.w, r.h, r.kg, r.qty - r.qty / 2, v_mid, 'seed');
    end if;
    fuel := round(r.km / v_truck.mileage_kmpl * diesel);
    insert into public.route_options (company_id, trip_id, variant, distance_km, duration_min, geometry, toll_count, toll_cost_inr,
                                      fuel_cost_inr, driver_cost_inr, total_cost_inr, is_selected)
    values (p_company, v_trip, 'fastest', r.km, round(r.hours * 60),
            jsonb_build_object('type', 'LineString', 'coordinates',
              case when r.m_name is null then jsonb_build_array(jsonb_build_array(r.o_lng, r.o_lat), jsonb_build_array(r.d_lng, r.d_lat))
                   else jsonb_build_array(jsonb_build_array(r.o_lng, r.o_lat), jsonb_build_array(r.m_lng, r.m_lat), jsonb_build_array(r.d_lng, r.d_lat)) end),
            greatest(1, r.km / 120), r.tolls, fuel, round(r.hours * coalesce((select driver_cost_inr_per_h from public.company_settings where company_id = p_company), 150)), fuel + r.tolls + round(r.hours * coalesce((select driver_cost_inr_per_h from public.company_settings where company_id = p_company), 150)), true)
    returning id into v_route;
    update public.trips set selected_route_id = v_route where id = v_trip;
    insert into public.load_plans (company_id, trip_id, version, status, engine_version, input_hash, metrics)
    values (p_company, v_trip, 1, 'active', 'seed', 'seed', jsonb_build_object('volumeUsedPct', 55 + (r.days * 3) % 30, 'weightUsedPct', 48 + (r.days * 5) % 35));
  end loop;

  -- costs the owner or driver added on the way (Misc tab)
  insert into public.trip_expenses (company_id, trip_id, kind, amount_inr, note, added_by, created_at)
  select p_company, t.id, x.kind, x.amt, x.note, x.by, t.actual_departure + interval '5 hours'
  from (values
    ('TRP-2026-0023', 'challan', 2000, 'No-entry hours at Bhiwandi', 'driver'),
    ('TRP-2026-0023', 'parking', 300, 'Waited for unloading slot', 'driver'),
    ('TRP-2026-0026', 'loading', 1200, 'Hamali at Sachin GIDC', 'owner'),
    ('TRP-2026-0027', 'challan', 500, 'Pollution certificate expired', 'driver'),
    ('TRP-2026-0024', 'parking', 400, 'Night halt at Kishangarh', 'driver')
  ) as x(code, kind, amt, note, by)
  join public.trips t on t.company_id = p_company and t.code = x.code;

  -- chosen route for the live and the finished sample trips (map follows it, earnings show the real cost)
  for r in
    select * from (values
      ('TRP-2026-0029', 265, 300, 900, jsonb_build_array(jsonb_build_array(72.5996, 22.9196), jsonb_build_array(73.1902, 22.2587), jsonb_build_array(72.8820, 21.0850))),
      ('TRP-2026-0030', 470, 640, 1800, jsonb_build_array(jsonb_build_array(75.7700, 26.9670), jsonb_build_array(73.7125, 24.5854), jsonb_build_array(72.9665, 23.5986)))
    ) as v(code, km, mins, tolls, coords)
  loop
    select t.* into v_truck from public.trucks t join public.trips x on x.truck_id = t.id where x.company_id = p_company and x.code = r.code;
    if not found then continue; end if;
    fuel := round(r.km / v_truck.mileage_kmpl * diesel);
    insert into public.route_options (company_id, trip_id, variant, distance_km, duration_min, geometry, toll_count, toll_cost_inr,
                                      fuel_cost_inr, driver_cost_inr, total_cost_inr, is_selected)
    select p_company, x.id, 'fastest', r.km, r.mins, jsonb_build_object('type', 'LineString', 'coordinates', r.coords),
           greatest(1, r.km / 120), r.tolls, fuel, round((r.mins / 60.0) * coalesce((select driver_cost_inr_per_h from public.company_settings where company_id = p_company), 150)), fuel + r.tolls + round((r.mins / 60.0) * coalesce((select driver_cost_inr_per_h from public.company_settings where company_id = p_company), 150)), true
    from public.trips x where x.company_id = p_company and x.code = r.code
    returning id into v_route;
    update public.trips set selected_route_id = v_route, driver_name = v_truck.driver_name, driver_phone = v_truck.driver_phone
    where company_id = p_company and code = r.code;
  end loop;

  -- the finished sample trip was weighed at the loading point: matches the declared 5,400 kg
  insert into public.trip_weighings (company_id, trip_id, gross_kg, tare_kg, lat, lng, accuracy_m, entered_by)
  select p_company, id, 14980, 9500, 26.9655, 75.7712, 12, 'driver' from public.trips where company_id = p_company and code = 'TRP-2026-0030';

  -- a trip being loaded right now (Jaipur → Delhi → Panipat)
  select * into v_truck from public.trucks where company_id = p_company and reg_no = 'RJ14 GC 7735';
  if found then
    insert into public.trips (company_id, code, truck_id, status, planned_departure, base_freight_inr, driver_name, driver_phone, notes, is_sample)
    values (p_company, 'TRP-2026-0032', v_truck.id, 'loading', now() + interval '3 hours', 23500, v_truck.driver_name, v_truck.driver_phone,
            'Home textiles and kitchenware for two wholesalers.', true)
    returning id into v_trip;
    insert into public.trip_stops (company_id, trip_id, seq, stop_type, name, city, lat, lng) values
      (p_company, v_trip, 0, 'origin', 'Jaipur (VKIA)', 'Jaipur', 26.9670, 75.7700);
    insert into public.trip_stops (company_id, trip_id, seq, stop_type, name, city, lat, lng, window_end)
    values (p_company, v_trip, 1, 'drop', 'Delhi (Okhla)', 'Delhi', 28.5355, 77.2750, now() + interval '14 hours') returning id into v_mid;
    insert into public.trip_stops (company_id, trip_id, seq, stop_type, name, city, lat, lng, window_end)
    values (p_company, v_trip, 2, 'drop', 'Panipat', 'Panipat', 29.3909, 76.9635, now() + interval '20 hours') returning id into v_d;
    insert into public.cargo_items (company_id, trip_id, label, client_name, length_cm, width_cm, height_cm, weight_kg, quantity,
                                    drop_stop_id, fragile, upright_only, stackable, source) values
      (p_company, v_trip, 'Cotton bedsheet bales', 'Okhla Home Furnishings', 90, 60, 50, 45, 40, v_mid, false, false, true, 'seed'),
      (p_company, v_trip, 'Steel kitchenware cartons', 'Okhla Home Furnishings', 60, 45, 40, 22, 30, v_mid, false, false, true, 'seed'),
      (p_company, v_trip, 'Handloom carpet rolls', 'Panipat Weavers', 200, 40, 40, 30, 24, v_d, false, false, true, 'seed');
    update public.trucks set status = 'active' where id = v_truck.id;
  end if;

  insert into public.activity_log (company_id, kind, message, entity_type, entity_ref, is_sample, created_at) values
    (p_company, 'trip_completed', 'Trip completed at Ahmedabad (Narol)', 'trip', 'TRP-2026-0027', true, now() - interval '4 days' + interval '13 hours'),
    (p_company, 'trip_planned', 'Loading started: Jaipur → Delhi → Panipat', 'trip', 'TRP-2026-0032', true, now() - interval '30 minutes');
end;
$$;
revoke all on function public._seed_demo_extras(uuid) from public, anon, authenticated;

-- first sign-in and "Reset sample data" add the extras too
create or replace function public.seed_sample_data()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_c uuid := public.current_company_id();
begin
  if v_c is null then raise exception 'NOT_SIGNED_IN'; end if;
  perform 1 from public.companies where id = v_c and sample_seeded_at is null for update;
  if not found then return jsonb_build_object('seeded', false); end if;
  if public.sample_data_allowed() then
    perform public._seed_company(v_c); perform public._seed_more_loads(v_c); perform public._seed_demo_extras(v_c);
  end if;
  update public.companies set sample_seeded_at = now() where id = v_c;
  return jsonb_build_object('seeded', public.sample_data_allowed());
end;
$$;

create or replace function public.reset_sample_data()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_c uuid := public.current_company_id();
begin
  if v_c is null then raise exception 'NOT_SIGNED_IN'; end if;
  if not public.sample_data_allowed() then raise exception 'NOT_ALLOWED'; end if;
  update public.freight_listings set status = 'open', accepted_by_company = null
   where accepted_by_company = v_c and visibility = 'public';
  delete from public.trips where company_id = v_c and is_sample;
  delete from public.freight_listings where company_id = v_c and is_sample;
  delete from public.alerts where company_id = v_c and is_sample;
  delete from public.activity_log where company_id = v_c and is_sample;
  delete from public.fleet_daily_stats where company_id = v_c and is_sample;
  delete from public.trucks t where t.company_id = v_c and t.is_sample
    and not exists (select 1 from public.trips x where x.truck_id = t.id);
  perform public._seed_company_missing_trucks_guard(v_c);
  perform public._seed_company(v_c); perform public._seed_more_loads(v_c); perform public._seed_demo_extras(v_c);
  update public.companies set sample_seeded_at = now() where id = v_c;
  return jsonb_build_object('reset', true);
end;
$$;
