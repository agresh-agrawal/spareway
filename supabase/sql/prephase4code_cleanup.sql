-- Pre-Phase 4 cleanup (owner, 2026-10-31). Additive file; applied with the Supabase MCP.
-- 1. Sample data only for the owner's own account and the two QA test accounts; everyone else starts empty.
-- 2. Problems: only loader reports stay (loader_issue, loader_cargo). 3. Fuel tracking removed (trucks.fuel_level_pct).

create or replace function public.sample_data_allowed()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select lower(email) from auth.users where id = auth.uid())
                  in ('agresh@agreshagrawal.com', 'qa.owner@spareway.test', 'qa.owner2@spareway.test'), false);
$$;
revoke all on function public.sample_data_allowed() from public, anon;
grant execute on function public.sample_data_allowed() to authenticated;

create or replace function public._seed_company(p_company uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  t_demo uuid; t_live uuid; t_done uuid;
  s1 uuid; s2 uuid; s3 uuid; l2 uuid; d1 uuid;
  dep timestamptz := date_trunc('day', now()) + interval '1 day' + interval '30 minutes';  -- 06:00 IST tomorrow
  tr_demo uuid; tr_live uuid; tr_done uuid;
begin
  insert into public.trucks (company_id, reg_no, model, body_type, internal_length_cm, internal_width_cm, internal_height_cm,
                             payload_kg, gross_weight_kg, axles, mileage_kmpl, cost_per_km_inr, status, home_city,
                             driver_name, driver_phone, last_lat, last_lng, is_sample) values
    (p_company, 'MP09 HG 4821', 'Tata Signa 3118.T · 32 ft MXL container', 'container', 975, 243, 243, 15000, 31000, 3, 3.6, 34, 'active', 'Indore', 'Ramesh Yadav', '+91 98270 00001', 28.3540, 76.9366, true),
    (p_company, 'RJ14 GC 7735', 'Ashok Leyland 2820 · 24 ft closed body', 'closed', 732, 244, 244, 10000, 28000, 3, 4.2, 28, 'idle', 'Jaipur', 'Suresh Meena', '+91 98290 00002', 26.7787, 75.8306, true),
    (p_company, 'GJ01 KT 2208', 'Eicher Pro 3015 · 19 ft closed body', 'closed', 579, 214, 214, 9000, 16000, 2, 5.5, 22, 'active', 'Ahmedabad', 'Vikram Patel', '+91 98250 00003', 22.3072, 73.1812, true),
    (p_company, 'MH04 LQ 9913', 'BharatBenz 1617R · 22 ft container', 'container', 670, 244, 244, 9000, 16200, 2, 5.0, 25, 'maintenance', 'Mumbai', 'Anil Pawar', '+91 98200 00004', 19.2813, 73.0483, true),
    (p_company, 'MP09 KR 1147', 'Tata 1412 LPT · 17 ft closed body', 'closed', 518, 213, 213, 7000, 14000, 2, 6.0, 20, 'offline', 'Indore', 'Mahesh Chouhan', '+91 98260 00005', 22.7196, 75.8577, true),
    (p_company, 'RJ14 TB 3360', 'Tata Ultra 1918.T · 20 ft closed body', 'closed', 610, 229, 229, 9000, 18500, 2, 5.2, 24, 'active', 'Jaipur', 'Imran Khan', '+91 98290 00006', 23.5986, 72.9665, true);

  select id into tr_demo from public.trucks where company_id = p_company and reg_no = 'MP09 HG 4821';
  select id into tr_live from public.trucks where company_id = p_company and reg_no = 'GJ01 KT 2208';
  select id into tr_done from public.trucks where company_id = p_company and reg_no = 'RJ14 TB 3360';

  -- DEMO trip: Manesar → 1 Jaipur → 2 Ahmedabad → 3 Mumbai (Bhiwandi); 104 units, ~2/3 of the floor
  insert into public.trips (company_id, code, truck_id, status, planned_departure, base_freight_inr, notes, is_sample)
  values (p_company, 'TRP-2026-0031', tr_demo, 'planned', dep, 62000, 'Consumer durables for three distributors. Demo trip.', true)
  returning id into t_demo;
  insert into public.trip_stops (company_id, trip_id, seq, stop_type, name, city, lat, lng) values
    (p_company, t_demo, 0, 'origin', 'Manesar warehouse', 'Gurugram', 28.3540, 76.9366);
  insert into public.trip_stops (company_id, trip_id, seq, stop_type, name, city, lat, lng, window_start, window_end)
  values (p_company, t_demo, 1, 'drop', 'Jaipur (Sitapura)', 'Jaipur', 26.7787, 75.8306, dep + interval '5 hours', dep + interval '10 hours')
  returning id into s1;
  insert into public.trip_stops (company_id, trip_id, seq, stop_type, name, city, lat, lng, window_start, window_end)
  values (p_company, t_demo, 2, 'drop', 'Ahmedabad (Narol)', 'Ahmedabad', 22.9536, 72.5947, dep + interval '18 hours', dep + interval '28 hours')
  returning id into s2;
  insert into public.trip_stops (company_id, trip_id, seq, stop_type, name, city, lat, lng, window_start, window_end)
  values (p_company, t_demo, 3, 'drop', 'Mumbai (Bhiwandi)', 'Bhiwandi', 19.2813, 73.0483, dep + interval '34 hours', dep + interval '46 hours')
  returning id into s3;
  insert into public.cargo_items (company_id, trip_id, label, sku, client_name, length_cm, width_cm, height_cm, weight_kg, quantity,
                                  drop_stop_id, fragile, upright_only, stackable, priority, source) values
    (p_company, t_demo, 'Split AC indoor unit 1.5T', 'AC-IN-15', 'Shree Electronics, Jaipur', 95, 32, 38, 14, 24, s1, false, true, true, 'normal', 'seed'),
    (p_company, t_demo, 'Ceiling fan (carton of 4)', 'FAN-4PK', 'Shree Electronics, Jaipur', 60, 40, 45, 18, 16, s1, false, false, true, 'low', 'seed'),
    (p_company, t_demo, 'Split AC outdoor unit 1.5T', 'AC-OUT-15', 'Patel Appliances, Ahmedabad', 90, 40, 70, 38, 20, s2, false, true, true, 'normal', 'seed'),
    (p_company, t_demo, 'LED TV 43 inch', 'TV-43', 'Patel Appliances, Ahmedabad', 105, 18, 68, 11, 12, s2, true, true, false, 'high', 'seed'),
    (p_company, t_demo, 'Washing machine front-load', 'WM-FL7', 'Konkan Retail, Bhiwandi', 65, 65, 90, 72, 8, s3, false, true, true, 'normal', 'seed'),
    (p_company, t_demo, 'Refrigerator 260 L', 'RF-260', 'Konkan Retail, Bhiwandi', 62, 70, 165, 52, 6, s3, false, true, false, 'high', 'seed'),
    (p_company, t_demo, 'Microwave oven 25 L', 'MW-25', 'Konkan Retail, Bhiwandi', 52, 42, 35, 13, 18, s3, true, false, true, 'normal', 'seed');

  -- LIVE trip (in transit): Ahmedabad → Vadodara (done) → Surat
  insert into public.trips (company_id, code, truck_id, status, planned_departure, actual_departure, base_freight_inr, is_sample)
  values (p_company, 'TRP-2026-0029', tr_live, 'in_transit', now() - interval '3 hours', now() - interval '3 hours', 21000, true)
  returning id into t_live;
  insert into public.trip_stops (company_id, trip_id, seq, stop_type, name, city, lat, lng, status) values
    (p_company, t_live, 0, 'origin', 'Ahmedabad (Aslali)', 'Ahmedabad', 22.9196, 72.5996, 'done');
  insert into public.trip_stops (company_id, trip_id, seq, stop_type, name, city, lat, lng, eta, window_end, status) values
    (p_company, t_live, 1, 'drop', 'Vadodara (Makarpura)', 'Vadodara', 22.2587, 73.1902, now() - interval '20 minutes', now() + interval '1 hour', 'done');
  insert into public.trip_stops (company_id, trip_id, seq, stop_type, name, city, lat, lng, eta, window_end)
  values (p_company, t_live, 2, 'drop', 'Surat (Sachin GIDC)', 'Surat', 21.0850, 72.8820, now() + interval '3 hours', now() + interval '5 hours')
  returning id into l2;
  insert into public.cargo_items (company_id, trip_id, label, client_name, length_cm, width_cm, height_cm, weight_kg, quantity, drop_stop_id, source)
  values (p_company, t_live, 'Pharma cartons', 'Zydus distributor', 60, 40, 40, 12, 120, l2, 'seed');
  insert into public.load_plans (company_id, trip_id, version, status, engine_version, input_hash, metrics)
  values (p_company, t_live, 1, 'active', 'seed', 'seed', '{"volumeUsedPct": 78.4, "weightUsedPct": 61.2}');

  -- COMPLETED trip: Jaipur → Himmatnagar (on time)
  insert into public.trips (company_id, code, truck_id, status, planned_departure, actual_departure, completed_at, base_freight_inr, is_sample)
  values (p_company, 'TRP-2026-0030', tr_done, 'completed', now() - interval '20 hours', now() - interval '20 hours', now() - interval '2 hours', 28500, true)
  returning id into t_done;
  insert into public.trip_stops (company_id, trip_id, seq, stop_type, name, city, lat, lng, status) values
    (p_company, t_done, 0, 'origin', 'Jaipur (VKIA)', 'Jaipur', 26.9670, 75.7700, 'done');
  insert into public.trip_stops (company_id, trip_id, seq, stop_type, name, city, lat, lng, eta, window_end, status)
  values (p_company, t_done, 1, 'drop', 'Himmatnagar', 'Himmatnagar', 23.5986, 72.9665, now() - interval '2 hours', now() - interval '1 hour', 'done')
  returning id into d1;
  insert into public.cargo_items (company_id, trip_id, label, client_name, length_cm, width_cm, height_cm, weight_kg, quantity, drop_stop_id, source)
  values (p_company, t_done, 'Marble tiles crate', 'Sanghvi Ceramics', 120, 60, 40, 180, 30, d1, 'seed');
  insert into public.load_plans (company_id, trip_id, version, status, engine_version, input_hash, metrics)
  values (p_company, t_done, 1, 'active', 'seed', 'seed', '{"volumeUsedPct": 64.0, "weightUsedPct": 60.0}');

  -- private copies of the sample marketplace (8 good fits on NH48 + 4 decoys)
  insert into public.freight_listings (company_id, visibility, code, shipper_name, shipper_phone, goods_type, description,
     pickup_name, pickup_lat, pickup_lng, drop_name, drop_lat, drop_lng, length_cm, width_cm, height_cm, weight_kg, quantity,
     fragile, upright_only, stackable, offered_rate_inr, ready_from, deliver_by, status, is_sample) values
    (p_company, 'company', 'LD-1041', 'Kishangarh Marble House', '+91 90000 10041', 'Marble tiles', 'Polished tiles in wooden crates', 'Kishangarh', 26.5900, 74.8540, 'Ahmedabad (Narol)', 22.9536, 72.5947, 120, 60, 40, 180, 8, true, false, false, 16000, now(), now() + interval '3 days', 'open', true),
    (p_company, 'company', 'LD-1042', 'Beawar Textiles', '+91 90000 10042', 'Textile bales', 'Compressed cotton bales', 'Beawar', 26.1011, 74.3200, 'Mumbai (Bhiwandi)', 19.2813, 73.0483, 100, 60, 50, 90, 20, false, false, true, 24000, now(), now() + interval '4 days', 'open', true),
    (p_company, 'company', 'LD-1043', 'Udaipur Handicrafts Co-op', '+91 90000 10043', 'Handicraft cartons', 'Wooden decor, packed', 'Udaipur', 24.5854, 73.7125, 'Vadodara', 22.3072, 73.1812, 60, 50, 50, 20, 25, true, true, true, 9000, now(), now() + interval '3 days', 'open', true),
    (p_company, 'company', 'LD-1044', 'Himmatnagar Ceramics', '+91 90000 10044', 'Ceramic sanitaryware', 'Boxed wash basins', 'Himmatnagar', 23.5986, 72.9665, 'Mumbai (Bhiwandi)', 19.2813, 73.0483, 70, 55, 45, 25, 30, true, true, true, 15500, now(), now() + interval '4 days', 'open', true),
    (p_company, 'company', 'LD-1045', 'Vadodara Auto Components', '+91 90000 10045', 'Auto parts', 'Brake assemblies in cartons', 'Vadodara', 22.3072, 73.1812, 'Mumbai (Bhiwandi)', 19.2813, 73.0483, 80, 60, 60, 45, 18, false, false, true, 14000, now(), now() + interval '3 days', 'open', true),
    (p_company, 'company', 'LD-1046', 'Surat Silk Mills', '+91 90000 10046', 'Fabric rolls', 'Synthetic fabric rolls, wrapped', 'Surat (Kamrej)', 21.2706, 72.9590, 'Mumbai (Bhiwandi)', 19.2813, 73.0483, 150, 40, 40, 35, 24, false, false, true, 9500, now(), now() + interval '2 days', 'open', true),
    (p_company, 'company', 'LD-1047', 'Bharuch Foods', '+91 90000 10047', 'Packaged snacks', 'Light cartons, keep dry', 'Bharuch', 21.7051, 72.9959, 'Surat (Kamrej)', 21.2706, 72.9590, 60, 40, 40, 6, 40, false, false, true, 4200, now(), now() + interval '2 days', 'open', true),
    (p_company, 'company', 'LD-1048', 'Vapi Paper Products', '+91 90000 10048', 'Paper reels', 'Kraft paper reels on pallets', 'Vapi', 20.3893, 72.9106, 'Mumbai (Bhiwandi)', 19.2813, 73.0483, 110, 110, 120, 600, 3, false, true, false, 11000, now(), now() + interval '2 days', 'open', true),
    (p_company, 'company', 'LD-1049', 'Malwa Agro', '+91 90000 10049', 'Soybean bags', 'Off corridor (Indore → Bhopal)', 'Indore', 22.7196, 75.8577, 'Bhopal', 23.2599, 77.4126, 80, 50, 30, 50, 40, false, false, true, 18000, now(), now() + interval '3 days', 'open', true),
    (p_company, 'company', 'LD-1050', 'Mumbai Movers', '+91 90000 10050', 'Office furniture', 'Wrong direction (Mumbai → Ahmedabad)', 'Mumbai (Bhiwandi)', 19.2813, 73.0483, 'Ahmedabad (Narol)', 22.9536, 72.5947, 120, 80, 90, 60, 10, false, false, true, 20000, now(), now() + interval '3 days', 'open', true),
    (p_company, 'company', 'LD-1051', 'Gujarat Steel Traders', '+91 90000 10051', 'Steel coils', 'Too heavy for remaining payload', 'Vadodara', 22.3072, 73.1812, 'Mumbai (Bhiwandi)', 19.2813, 73.0483, 150, 150, 120, 4000, 4, false, true, false, 45000, now(), now() + interval '3 days', 'open', true),
    (p_company, 'company', 'LD-1052', 'Jaipur Blue Pottery', '+91 90000 10052', 'Pottery', 'Low offer: likely negative net benefit', 'Jaipur (Sitapura)', 26.7787, 75.8306, 'Udaipur', 24.5854, 73.7125, 50, 40, 40, 15, 6, true, true, false, 300, now(), now() + interval '3 days', 'open', true);

  insert into public.activity_log (company_id, kind, message, entity_type, entity_ref, is_sample, created_at) values
    (p_company, 'trip_departed', 'Trip departed Ahmedabad (Aslali)', 'truck', 'GJ01 KT 2208', true, now() - interval '3 hours'),
    (p_company, 'stop_done', 'Delivered at Vadodara (Makarpura)', 'trip', 'TRP-2026-0029', true, now() - interval '20 minutes'),
    (p_company, 'trip_completed', 'Trip completed at Himmatnagar', 'trip', 'TRP-2026-0030', true, now() - interval '2 hours'),
    (p_company, 'trip_planned', 'Trip planned: Manesar → Jaipur → Ahmedabad → Mumbai', 'trip', 'TRP-2026-0031', true, now() - interval '1 hour');

  insert into public.fleet_daily_stats (company_id, day, utilisation_pct, distance_km, on_time_pct, delayed_pct,
                                        revenue_inr, cost_inr, extra_load_revenue_inr, is_sample)
  select p_company, (current_date - g)::date,
         round((58 + 10 * sin(g / 3.0) + (g % 5))::numeric, 1),
         round((1800 + 400 * cos(g / 4.0) + 37 * (g % 7))::numeric, 0),
         round((88 + 6 * sin(g / 5.0))::numeric, 1),
         round((12 - 6 * sin(g / 5.0))::numeric, 1),
         round((180000 + 30000 * sin(g / 6.0))::numeric, 0),
         round((140000 + 15000 * cos(g / 6.0))::numeric, 0),
         case when g < 7 then round((8000 + 1500 * g)::numeric, 0) else 0 end,
         true
  from generate_series(1, 30) g;
end;
$$;

create or replace function public.seed_sample_data()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_c uuid := public.current_company_id();
begin
  if v_c is null then raise exception 'NOT_SIGNED_IN'; end if;
  perform 1 from public.companies where id = v_c and sample_seeded_at is null for update;
  if not found then return jsonb_build_object('seeded', false); end if;
  if public.sample_data_allowed() then perform public._seed_company(v_c); end if;
  update public.companies set sample_seeded_at = now() where id = v_c;  -- never asked again
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
  perform public._seed_company(v_c);
  update public.companies set sample_seeded_at = now() where id = v_c;
  return jsonb_build_object('reset', true);
end;
$$;

-- remove sample rows from every other account (their own rows stay)
do $$
declare c uuid;
begin
  for c in
    select p.company_id from public.profiles p join auth.users u on u.id = p.id
     where lower(u.email) not in ('agresh@agreshagrawal.com', 'qa.owner@spareway.test', 'qa.owner2@spareway.test')
  loop
    update public.freight_listings set status = 'open', accepted_by_company = null
     where accepted_by_company = c and visibility = 'public';
    delete from public.trips where company_id = c and is_sample;
    delete from public.freight_listings where company_id = c and is_sample;
    delete from public.alerts where company_id = c and is_sample;
    delete from public.activity_log where company_id = c and is_sample;
    delete from public.fleet_daily_stats where company_id = c and is_sample;
    delete from public.trucks t where t.company_id = c and t.is_sample
      and not exists (select 1 from public.trips x where x.truck_id = t.id);
    update public.companies set sample_seeded_at = coalesce(sample_seeded_at, now()) where id = c;
  end loop;
end $$;

-- problems: only loader reports remain
delete from public.alerts where kind not in ('loader_issue', 'loader_cargo');
alter table public.alerts drop constraint alerts_kind_check;
alter table public.alerts add constraint alerts_kind_check check (kind in ('loader_issue', 'loader_cargo'));

-- fuel tracking
alter table public.trucks drop column if exists fuel_level_pct;
