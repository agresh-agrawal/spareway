-- =====================================================================
-- SPAREWAY DATABASE (final) — multi-company, one role (Owner), no-login loader links
-- Run in order: PART 1 schema → PART 2 functions → PART 3 global sample data.
--   Supabase MCP: apply each PART as its own migration (names: schema, functions, global_seed).
--   No MCP: paste the whole file into Supabase Dashboard → SQL Editor → Run.
-- Company sample data (trucks, demo trip, listings…) is NOT inserted here: it is created
-- per company by seed_sample_data() the first time a new owner logs in.
-- Units: cm, kg, km, INR. Times: timestamptz (UTC), shown in Asia/Kolkata.
-- =====================================================================

-- ########################## PART 1 — SCHEMA ##########################

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- companies: every signup gets its own company. All business data has company_id.
-- ---------------------------------------------------------------------
create table public.companies (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  city              text not null default '',
  phone             text not null default '',
  created_by        uuid references auth.users (id) on delete set null,
  sample_seeded_at  timestamptz,               -- null = sample data not created yet
  created_at        timestamptz not null default now()
);

-- one profile per auth user; one role only (Owner) — no role column needed
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  company_id      uuid not null references public.companies (id) on delete cascade,
  full_name       text not null default '',
  email           text not null default '',
  preferred_lang  text not null default 'en' check (preferred_lang in ('en', 'hi')),
  created_at      timestamptz not null default now()
);

create index profiles_company_idx on public.profiles (company_id);

-- the caller's company (used by defaults and RLS). SECURITY DEFINER so it can read profiles.
create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.profiles where id = auth.uid();
$$;

-- per-company tunable constants (Settings page)
create table public.company_settings (
  company_id                 uuid primary key references public.companies (id) on delete cascade,
  diesel_price_inr_per_l     numeric not null default 90,
  driver_cost_inr_per_h      numeric not null default 120,
  value_of_time_inr_per_h    numeric not null default 150,
  handling_inr_per_kg        numeric not null default 0.5,
  waiting_cost_inr_per_h     numeric not null default 300,
  delay_penalty_inr_per_min  numeric not null default 10,
  min_margin_inr             numeric not null default 500,
  corridor_km                numeric not null default 20,
  road_factor                numeric not null default 1.25,
  break_after_drive_h        numeric not null default 5,
  break_min                  int     not null default 30,
  max_drive_h_per_day        numeric not null default 10,
  overnight_rest_h           numeric not null default 8,
  avg_speed_kmph             numeric not null default 45,
  checkpoint_delay_min       int     not null default 20,
  support_ratio              numeric not null default 1.0,
  cargo_unit                 text    not null default 'cm' check (cargo_unit in ('cm', 'in')),
  updated_at                 timestamptz not null default now()
);

create trigger company_settings_updated_at before update on public.company_settings
  for each row execute function public.set_updated_at();

-- new auth user (email signup or Google) → company + profile + settings
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name    text := coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''),
                             nullif(new.raw_user_meta_data ->> 'name', ''),
                             split_part(coalesce(new.email, 'owner'), '@', 1));
  v_company text := coalesce(nullif(new.raw_user_meta_data ->> 'company_name', ''),
                             v_name || ' Transport');
  v_cid     uuid;
begin
  insert into public.companies (name, created_by) values (v_company, new.id) returning id into v_cid;
  insert into public.profiles (id, company_id, full_name, email)
  values (new.id, v_cid, v_name, coalesce(new.email, ''));
  insert into public.company_settings (company_id) values (v_cid);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- trucks
-- ---------------------------------------------------------------------
create table public.trucks (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null default public.current_company_id() references public.companies (id) on delete cascade,
  reg_no              text not null,
  model               text not null default '',
  body_type           text not null default 'closed' check (body_type in ('closed', 'container', 'open')),
  internal_length_cm  numeric not null check (internal_length_cm > 0),
  internal_width_cm   numeric not null check (internal_width_cm > 0),
  internal_height_cm  numeric not null check (internal_height_cm > 0),
  payload_kg          numeric not null check (payload_kg > 0),
  gross_weight_kg     numeric,
  axles               int not null default 2 check (axles between 2 and 8),
  door_position       text not null default 'rear' check (door_position in ('rear', 'side', 'rear_side')),
  fuel_type           text not null default 'diesel',
  mileage_kmpl        numeric not null default 4 check (mileage_kmpl > 0),
  cost_per_km_inr     numeric not null default 30 check (cost_per_km_inr >= 0),
  status              text not null default 'idle' check (status in ('active', 'idle', 'maintenance', 'offline')),
  home_city           text not null default '',
  driver_name         text not null default '',
  driver_phone        text not null default '',
  last_lat            double precision,
  last_lng            double precision,
  fuel_level_pct      numeric check (fuel_level_pct between 0 and 100),
  is_sample           boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint trucks_company_reg_unique unique (company_id, reg_no)
);
create index trucks_company_idx on public.trucks (company_id);
create trigger trucks_updated_at before update on public.trucks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- trips (+ the no-login loader link lives on the trip, so re-plans keep the same link)
-- ---------------------------------------------------------------------
create table public.trips (
  id                       uuid primary key default gen_random_uuid(),
  company_id               uuid not null default public.current_company_id() references public.companies (id) on delete cascade,
  code                     text not null,
  truck_id                 uuid not null references public.trucks (id) on delete restrict,
  status                   text not null default 'planned'
                           check (status in ('planned', 'loading', 'in_transit', 'completed', 'cancelled')),
  planned_departure        timestamptz,
  actual_departure         timestamptz,
  completed_at             timestamptz,
  base_freight_inr         numeric not null default 0,
  selected_route_id        uuid,
  notes                    text not null default '',
  loader_token             text unique,
  loader_token_expires_at  timestamptz,
  loader_link_enabled      boolean not null default false,
  is_sample                boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint trips_company_code_unique unique (company_id, code)
);
create index trips_company_idx on public.trips (company_id);
create index trips_truck_idx on public.trips (truck_id);
create trigger trips_updated_at before update on public.trips
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- trip_stops: seq 0 = origin, then drops/pickups in order
-- ---------------------------------------------------------------------
create table public.trip_stops (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null default public.current_company_id() references public.companies (id) on delete cascade,
  trip_id       uuid not null references public.trips (id) on delete cascade,
  seq           int  not null check (seq >= 0),
  stop_type     text not null check (stop_type in ('origin', 'drop', 'pickup')),
  name          text not null,
  city          text not null default '',
  lat           double precision not null,
  lng           double precision not null,
  window_start  timestamptz,
  window_end    timestamptz,
  eta           timestamptz,
  status        text not null default 'pending' check (status in ('pending', 'arrived', 'done')),
  created_at    timestamptz not null default now(),
  constraint trip_stops_trip_seq_unique unique (trip_id, seq) deferrable initially deferred
);
create index trip_stops_trip_idx on public.trip_stops (trip_id);

-- ---------------------------------------------------------------------
-- freight_listings: visibility 'public' (everyone's marketplace) or 'company' (private sample copies)
-- ---------------------------------------------------------------------
create table public.freight_listings (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null default public.current_company_id() references public.companies (id) on delete cascade,
  visibility        text not null default 'public' check (visibility in ('public', 'company')),
  code              text not null,
  shipper_name      text not null,
  shipper_phone     text not null default '',
  goods_type        text not null,
  description       text not null default '',
  pickup_name       text not null,
  pickup_lat        double precision not null,
  pickup_lng        double precision not null,
  drop_name         text not null,
  drop_lat          double precision not null,
  drop_lng          double precision not null,
  length_cm         numeric not null check (length_cm > 0),
  width_cm          numeric not null check (width_cm > 0),
  height_cm         numeric not null check (height_cm > 0),
  weight_kg         numeric not null check (weight_kg > 0),          -- per unit
  quantity          int not null default 1 check (quantity > 0),
  fragile           boolean not null default false,
  upright_only      boolean not null default false,
  stackable         boolean not null default true,
  offered_rate_inr  numeric not null check (offered_rate_inr >= 0),  -- total for the consignment
  ready_from        timestamptz,
  deliver_by        timestamptz,
  status            text not null default 'open' check (status in ('open', 'reserved', 'accepted', 'expired')),
  posted_by         uuid references auth.users (id) on delete set null,
  accepted_by_company uuid references public.companies (id) on delete set null,
  is_sample         boolean not null default false,
  created_at        timestamptz not null default now(),
  constraint freight_listings_company_code_unique unique (company_id, code)
);
create index freight_listings_visible_idx on public.freight_listings (visibility, status);

-- ---------------------------------------------------------------------
-- trip_extra_loads: a listing evaluated for one trip
-- ---------------------------------------------------------------------
create table public.trip_extra_loads (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null default public.current_company_id() references public.companies (id) on delete cascade,
  trip_id               uuid not null references public.trips (id) on delete cascade,
  listing_id            uuid not null references public.freight_listings (id) on delete cascade,
  status                text not null default 'suggested' check (status in ('suggested', 'accepted', 'rejected')),
  pickup_stop_id        uuid references public.trip_stops (id) on delete set null,
  drop_stop_id          uuid references public.trip_stops (id) on delete set null,
  detour_km             numeric,
  detour_min            numeric,
  cost_breakdown        jsonb not null default '{}'::jsonb,
  incremental_cost_inr  numeric,
  net_benefit_inr       numeric,
  min_viable_rate_inr   numeric,
  feasibility           jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  constraint trip_extra_loads_unique unique (trip_id, listing_id)
);

-- ---------------------------------------------------------------------
-- cargo_items: manifest lines (quantity expands to units in the planner)
-- ---------------------------------------------------------------------
create table public.cargo_items (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null default public.current_company_id() references public.companies (id) on delete cascade,
  trip_id          uuid not null references public.trips (id) on delete cascade,
  label            text not null,
  sku              text not null default '',
  client_name      text not null default '',
  length_cm        numeric not null check (length_cm > 0),
  width_cm         numeric not null check (width_cm > 0),
  height_cm        numeric not null check (height_cm > 0),
  weight_kg        numeric not null check (weight_kg > 0),
  quantity         int not null default 1 check (quantity > 0),
  pickup_stop_id   uuid references public.trip_stops (id) on delete set null,     -- null = origin
  drop_stop_id     uuid not null references public.trip_stops (id),               -- checked at end of statement
  fragile          boolean not null default false,
  upright_only     boolean not null default false,
  stackable        boolean not null default true,
  max_top_load_kg  numeric,
  priority         text not null default 'normal' check (priority in ('low', 'normal', 'high', 'critical')),
  source           text not null default 'manual'
                   check (source in ('manual', 'csv', 'camera', 'voice', 'extra_load', 'seed')),
  added_by_loader  boolean not null default false,
  extra_load_id    uuid references public.trip_extra_loads (id) on delete cascade,
  image_path       text,
  confidence       numeric check (confidence between 0 and 1),
  created_at       timestamptz not null default now()
);
create index cargo_items_trip_idx on public.cargo_items (trip_id);

-- ---------------------------------------------------------------------
-- load_plans + loading_progress
-- ---------------------------------------------------------------------
create table public.load_plans (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null default public.current_company_id() references public.companies (id) on delete cascade,
  trip_id         uuid not null references public.trips (id) on delete cascade,
  version         int  not null,
  status          text not null default 'draft' check (status in ('draft', 'active', 'superseded')),
  engine_version  text not null,
  input_hash      text not null,
  placements      jsonb not null default '[]'::jsonb,
  unplaced        jsonb not null default '[]'::jsonb,
  metrics         jsonb not null default '{}'::jsonb,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  constraint load_plans_trip_version_unique unique (trip_id, version)
);

create table public.loading_progress (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null default public.current_company_id() references public.companies (id) on delete cascade,
  load_plan_id   uuid not null references public.load_plans (id) on delete cascade,
  step_index     int  not null check (step_index >= 1),
  placement_key  text not null,
  status         text not null default 'pending' check (status in ('pending', 'done', 'skipped', 'issue')),
  note           text not null default '',
  updated_at     timestamptz not null default now(),
  constraint loading_progress_unique unique (load_plan_id, step_index)
);
create trigger loading_progress_updated_at before update on public.loading_progress
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- routes
-- ---------------------------------------------------------------------
create table public.route_options (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null default public.current_company_id() references public.companies (id) on delete cascade,
  trip_id           uuid not null references public.trips (id) on delete cascade,
  variant           text not null check (variant in ('fastest', 'shortest', 'no_tolls', 'recommended', 'with_extra')),
  provider          text not null default 'ors',
  profile           text not null default 'driving-hgv',
  distance_km       numeric not null,
  duration_min      numeric not null,
  geometry          jsonb not null,
  toll_count        int not null default 0,
  toll_cost_inr     numeric not null default 0,
  fuel_cost_inr     numeric not null default 0,
  driver_cost_inr   numeric not null default 0,
  waiting_cost_inr  numeric not null default 0,
  checkpoint_count  int not null default 0,
  total_cost_inr    numeric not null default 0,
  score             numeric not null default 0,
  halts             jsonb not null default '[]'::jsonb,
  warnings          jsonb not null default '[]'::jsonb,
  is_selected       boolean not null default false,
  created_at        timestamptz not null default now()
);
create index route_options_trip_idx on public.route_options (trip_id);

alter table public.trips
  add constraint trips_selected_route_fk foreign key (selected_route_id)
  references public.route_options (id) on delete set null;

create table public.route_cache (            -- global, service role only
  key         text primary key,
  response    jsonb not null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- pois: global route data shared by all companies (tolls, dhabas, checkpoints, no-entry…)
-- ---------------------------------------------------------------------
create table public.pois (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('toll', 'dhaba', 'hotel', 'parking', 'fuel', 'checkpoint', 'city_entry', 'weighbridge')),
  name        text not null,
  lat         double precision not null,
  lng         double precision not null,
  highway     text not null default '',
  city        text not null default '',
  state       text not null default '',
  data        jsonb not null default '{}'::jsonb,
  source      text not null default 'sample',
  is_sample   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index pois_kind_idx on public.pois (kind);

-- ---------------------------------------------------------------------
-- dashboard feeds, chart history, AI log
-- ---------------------------------------------------------------------
create table public.alerts (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null default public.current_company_id() references public.companies (id) on delete cascade,
  truck_id     uuid references public.trucks (id) on delete cascade,
  trip_id      uuid references public.trips (id) on delete cascade,
  kind         text not null check (kind in ('route_deviation', 'engine_warning', 'low_fuel', 'overload', 'fatigue',
                                             'plan_unplaced', 'city_entry', 'delay', 'loader_issue', 'loader_cargo', 'other')),
  severity     text not null check (severity in ('info', 'warning', 'critical')),
  title        text not null,
  message      text not null default '',
  meta         jsonb not null default '{}'::jsonb,   -- template values so the app can show the text in Hindi
  resolved     boolean not null default false,
  resolved_at  timestamptz,
  is_sample    boolean not null default false,
  created_at   timestamptz not null default now()
);
create index alerts_company_open_idx on public.alerts (company_id, resolved, severity);

create table public.activity_log (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null default public.current_company_id() references public.companies (id) on delete cascade,
  kind         text not null,
  message      text not null,
  entity_type  text not null default '',
  entity_ref   text not null default '',
  meta         jsonb not null default '{}'::jsonb,
  is_sample    boolean not null default false,
  created_at   timestamptz not null default now()
);
create index activity_company_created_idx on public.activity_log (company_id, created_at desc);

create table public.fleet_daily_stats (
  company_id              uuid not null default public.current_company_id() references public.companies (id) on delete cascade,
  day                     date not null,
  utilisation_pct         numeric not null,
  distance_km             numeric not null,
  on_time_pct             numeric not null,
  delayed_pct             numeric not null,
  revenue_inr             numeric not null default 0,
  cost_inr                numeric not null default 0,
  extra_load_revenue_inr  numeric not null default 0,
  is_sample               boolean not null default true,
  primary key (company_id, day)
);

create table public.ai_scans (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null default public.current_company_id() references public.companies (id) on delete cascade,
  trip_id       uuid references public.trips (id) on delete cascade,
  kind          text not null check (kind in ('image', 'voice')),
  via_loader    boolean not null default false,
  input_paths   text[] not null default '{}',
  transcript    text not null default '',
  model         text not null default '',
  raw_response  jsonb not null default '{}'::jsonb,
  parsed_items  jsonb not null default '[]'::jsonb,
  warnings      jsonb not null default '[]'::jsonb,
  status        text not null default 'pending' check (status in ('pending', 'parsed', 'confirmed', 'failed')),
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);

-- =====================================================================
-- ROW LEVEL SECURITY — each company sees only its own rows.
-- Loaders (no login) never touch tables directly: they use the loader_* functions (PART 2).
-- =====================================================================
alter table public.companies          enable row level security;
alter table public.profiles           enable row level security;
alter table public.company_settings   enable row level security;
alter table public.trucks             enable row level security;
alter table public.trips              enable row level security;
alter table public.trip_stops         enable row level security;
alter table public.freight_listings   enable row level security;
alter table public.trip_extra_loads   enable row level security;
alter table public.cargo_items        enable row level security;
alter table public.load_plans         enable row level security;
alter table public.loading_progress   enable row level security;
alter table public.route_options      enable row level security;
alter table public.route_cache        enable row level security;   -- no policies = service role only
alter table public.pois               enable row level security;
alter table public.alerts             enable row level security;
alter table public.activity_log       enable row level security;
alter table public.fleet_daily_stats  enable row level security;
alter table public.ai_scans           enable row level security;

create policy companies_own_select on public.companies for select to authenticated
  using (id = public.current_company_id());
create policy companies_own_update on public.companies for update to authenticated
  using (id = public.current_company_id()) with check (id = public.current_company_id());

create policy profiles_same_company_select on public.profiles for select to authenticated
  using (company_id = public.current_company_id());
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and company_id = public.current_company_id());

create policy company_settings_own on public.company_settings for all to authenticated
  using (company_id = public.current_company_id()) with check (company_id = public.current_company_id());

do $$
declare t text;
begin
  foreach t in array array[
    'trucks', 'trips', 'trip_stops', 'trip_extra_loads', 'cargo_items', 'load_plans',
    'loading_progress', 'route_options', 'alerts', 'activity_log', 'fleet_daily_stats', 'ai_scans'
  ]
  loop
    execute format(
      'create policy %I on public.%I for all to authenticated using (company_id = public.current_company_id()) with check (company_id = public.current_company_id());',
      t || '_own_company', t);
  end loop;
end;
$$;

-- marketplace: everyone sees public listings + their own company's private (sample) ones
create policy freight_listings_select on public.freight_listings for select to authenticated
  using (visibility = 'public' or company_id = public.current_company_id());
create policy freight_listings_insert on public.freight_listings for insert to authenticated
  with check (company_id = public.current_company_id());
create policy freight_listings_update_own on public.freight_listings for update to authenticated
  using (company_id = public.current_company_id()) with check (company_id = public.current_company_id());
create policy freight_listings_delete_own on public.freight_listings for delete to authenticated
  using (company_id = public.current_company_id());

create policy pois_read on public.pois for select to authenticated using (true);

-- ---------------------------------------------------------------------
-- Storage: private bucket; files live at <company_id>/<trip_id>/<uuid>.jpg and are
-- uploaded by the ai-cargo Edge Function (service role). Owners can view their company's files.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('cargo-images', 'cargo-images', false)
on conflict (id) do nothing;

create policy cargo_images_company_read on storage.objects for select to authenticated
  using (bucket_id = 'cargo-images' and (storage.foldername(name))[1] = public.current_company_id()::text);

-- realtime (RLS applies to realtime too)
alter publication supabase_realtime add table public.alerts;
alter publication supabase_realtime add table public.activity_log;
alter publication supabase_realtime add table public.loading_progress;
alter publication supabase_realtime add table public.trucks;
alter publication supabase_realtime add table public.cargo_items;

-- ########################## PART 2 — FUNCTIONS AND VIEWS ##########################

create or replace function public.km_between(lat1 double precision, lng1 double precision,
                                             lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select 2 * 6371 * asin(sqrt(
           power(sin(radians(lat2 - lat1) / 2), 2) +
           cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)));
$$;

-- next trip code for the caller's company: TRP-2026-0032
create or replace function public.next_trip_code()
returns text language sql stable as $$
  select 'TRP-' || to_char(now(), 'YYYY') || '-' ||
         lpad((coalesce(max(nullif(split_part(code, '-', 3), '')::int), 0) + 1)::text, 4, '0')
  from public.trips
  where company_id = public.current_company_id()
    and code like 'TRP-' || to_char(now(), 'YYYY') || '-%';
$$;

-- next listing code (public marketplace posts): LD-xxxx
create or replace function public.next_listing_code()
returns text language sql stable as $$
  select 'LD-' || lpad((coalesce(max(nullif(split_part(code, '-', 2), '')::int), 2000) + 1)::text, 4, '0')
  from public.freight_listings
  where company_id = public.current_company_id() and code ~ '^LD-[0-9]+$';
$$;

-- ---------- read models (security_invoker → RLS filters to the caller's company) ----------
create or replace view public.trip_overview with (security_invoker = true) as
select
  t.id, t.company_id, t.code, t.status, t.planned_departure, t.actual_departure, t.base_freight_inr,
  t.truck_id, tr.reg_no, tr.model, tr.payload_kg,
  (tr.internal_length_cm * tr.internal_width_cm * tr.internal_height_cm) / 1e6                  as truck_volume_m3,
  (select s.name from public.trip_stops s where s.trip_id = t.id and s.seq = 0)                     as origin_name,
  (select s.name from public.trip_stops s where s.trip_id = t.id order by s.seq desc limit 1)       as final_stop_name,
  (select count(*) from public.trip_stops s where s.trip_id = t.id and s.stop_type <> 'origin')     as stop_count,
  coalesce((select sum(c.weight_kg * c.quantity) from public.cargo_items c where c.trip_id = t.id), 0) as cargo_weight_kg,
  coalesce((select sum(c.length_cm * c.width_cm * c.height_cm * c.quantity) / 1e6
            from public.cargo_items c where c.trip_id = t.id), 0)                                  as cargo_volume_m3,
  coalesce((select sum(c.quantity) from public.cargo_items c where c.trip_id = t.id), 0)           as cargo_units,
  lp.id                                   as active_plan_id,
  (lp.metrics ->> 'volumeUsedPct')::numeric as plan_volume_used_pct,
  (lp.metrics ->> 'weightUsedPct')::numeric as plan_weight_used_pct,
  ro.distance_km                          as route_distance_km,
  ro.duration_min                         as route_duration_min,
  ro.total_cost_inr                       as route_total_cost_inr
from public.trips t
join public.trucks tr on tr.id = t.truck_id
left join lateral (
  select p.* from public.load_plans p
  where p.trip_id = t.id and p.status = 'active' order by p.version desc limit 1
) lp on true
left join public.route_options ro on ro.id = t.selected_route_id;

create or replace view public.dashboard_stats with (security_invoker = true) as
select
  (select count(*) from public.trucks where status = 'active')                                  as active_trucks,
  (select count(*) from public.trucks)                                                          as total_trucks,
  (select count(*) from public.trucks where driver_name <> '' and status in ('active', 'idle')) as drivers_on_duty,
  (select count(*) from public.trucks where driver_name <> '')                                  as total_drivers,
  (select count(*) from public.trips where status in ('loading', 'in_transit'))                 as live_trips,
  (select round(avg((metrics ->> 'volumeUsedPct')::numeric), 1) from public.load_plans where status = 'active') as avg_utilisation_pct,
  (select round(100.0 * count(*) filter (where s.eta is not null and s.window_end is not null and s.eta <= s.window_end)
          / nullif(count(*) filter (where s.eta is not null and s.window_end is not null), 0), 1)
     from public.trip_stops s where s.status = 'done')                                          as on_time_pct;

create or replace view public.trip_financials with (security_invoker = true) as
select
  t.id as trip_id, t.company_id, t.code, t.status, t.planned_departure, t.base_freight_inr,
  coalesce(x.extra_revenue, 0)       as extra_revenue_inr,
  coalesce(x.extra_cost, 0)          as extra_cost_inr,
  coalesce(ro.total_cost_inr, 0)     as route_cost_inr,
  coalesce(ro.distance_km, 0)        as distance_km,
  t.base_freight_inr + coalesce(x.extra_revenue, 0) - coalesce(ro.total_cost_inr, 0) - coalesce(x.extra_cost, 0)
                                     as net_earnings_inr
from public.trips t
left join public.route_options ro on ro.id = t.selected_route_id
left join lateral (
  select sum(f.offered_rate_inr) as extra_revenue, sum(e.incremental_cost_inr) as extra_cost
  from public.trip_extra_loads e
  join public.freight_listings f on f.id = e.listing_id
  where e.trip_id = t.id and e.status = 'accepted'
) x on true;

-- ---------- load plan activation ----------
create or replace function public.activate_load_plan(p_plan_id uuid)
returns void language plpgsql security invoker as $$
declare
  v_trip uuid;
begin
  select trip_id into v_trip from public.load_plans where id = p_plan_id;
  if v_trip is null then raise exception 'PLAN_NOT_FOUND'; end if;

  update public.load_plans set status = 'superseded'
   where trip_id = v_trip and id <> p_plan_id and status = 'active';
  update public.load_plans set status = 'active' where id = p_plan_id;

  delete from public.loading_progress where load_plan_id = p_plan_id;
  insert into public.loading_progress (load_plan_id, step_index, placement_key)
  select p_plan_id, (elem ->> 'step')::int, elem ->> 'key'
  from public.load_plans lp, jsonb_array_elements(lp.placements) elem
  where lp.id = p_plan_id;

  insert into public.activity_log (kind, message, entity_type, entity_ref, meta)
  select 'plan_activated',
         'Load plan v' || lp.version || ' activated (' || coalesce(lp.metrics ->> 'volumeUsedPct', '?') || '% space used)',
         'trip', t.code, jsonb_build_object('plan_id', lp.id, 'version', lp.version,
                                            'volumeUsedPct', lp.metrics ->> 'volumeUsedPct')
  from public.load_plans lp join public.trips t on t.id = lp.trip_id
  where lp.id = p_plan_id;
end;
$$;

-- ---------- accept an extra load (SECURITY DEFINER: may mark another company's public listing accepted) ----------
create or replace function public.accept_extra_load(p_extra_load_id uuid, p_pickup_after_seq int, p_drop_after_seq int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me       uuid := public.current_company_id();
  v_x        public.trip_extra_loads%rowtype;
  v_l        public.freight_listings%rowtype;
  v_pickup   uuid;
  v_drop     uuid;
  v_pick_seq int;
  v_drop_seq int;
  v_code     text;
begin
  if v_me is null then raise exception 'NOT_SIGNED_IN'; end if;
  select * into v_x from public.trip_extra_loads where id = p_extra_load_id and company_id = v_me for update;
  if not found then raise exception 'EXTRA_LOAD_NOT_FOUND'; end if;
  if v_x.status = 'accepted' then raise exception 'ALREADY_ACCEPTED'; end if;
  if p_drop_after_seq < p_pickup_after_seq then raise exception 'DROP_BEFORE_PICKUP'; end if;

  select * into v_l from public.freight_listings
   where id = v_x.listing_id and (visibility = 'public' or company_id = v_me) for update;
  if not found then raise exception 'LISTING_NOT_FOUND'; end if;
  if v_l.status not in ('open', 'reserved') then raise exception 'LISTING_NOT_OPEN'; end if;

  -- pickup: reuse a stop within 2 km, else insert after p_pickup_after_seq
  select id, seq into v_pickup, v_pick_seq from public.trip_stops
   where trip_id = v_x.trip_id and public.km_between(lat, lng, v_l.pickup_lat, v_l.pickup_lng) <= 2
   order by seq limit 1;
  if v_pickup is null then
    update public.trip_stops set seq = seq + 1 where trip_id = v_x.trip_id and seq > p_pickup_after_seq;
    v_pick_seq := p_pickup_after_seq + 1;
    insert into public.trip_stops (company_id, trip_id, seq, stop_type, name, city, lat, lng)
    values (v_me, v_x.trip_id, v_pick_seq, 'pickup', v_l.pickup_name, v_l.pickup_name, v_l.pickup_lat, v_l.pickup_lng)
    returning id into v_pickup;
    if p_drop_after_seq >= p_pickup_after_seq then p_drop_after_seq := p_drop_after_seq + 1; end if;
  end if;

  -- drop: reuse a later stop within 2 km, else insert
  select id, seq into v_drop, v_drop_seq from public.trip_stops
   where trip_id = v_x.trip_id and seq > v_pick_seq
     and public.km_between(lat, lng, v_l.drop_lat, v_l.drop_lng) <= 2
   order by seq limit 1;
  if v_drop is null then
    if p_drop_after_seq < v_pick_seq then p_drop_after_seq := v_pick_seq; end if;
    update public.trip_stops set seq = seq + 1 where trip_id = v_x.trip_id and seq > p_drop_after_seq;
    v_drop_seq := p_drop_after_seq + 1;
    insert into public.trip_stops (company_id, trip_id, seq, stop_type, name, city, lat, lng, window_end)
    values (v_me, v_x.trip_id, v_drop_seq, 'drop', v_l.drop_name, v_l.drop_name, v_l.drop_lat, v_l.drop_lng, v_l.deliver_by)
    returning id into v_drop;
  end if;

  insert into public.cargo_items (company_id, trip_id, label, client_name, length_cm, width_cm, height_cm, weight_kg,
                                  quantity, pickup_stop_id, drop_stop_id, fragile, upright_only, stackable, source, extra_load_id)
  values (v_me, v_x.trip_id, v_l.goods_type || ' (' || v_l.code || ')', v_l.shipper_name, v_l.length_cm, v_l.width_cm,
          v_l.height_cm, v_l.weight_kg, v_l.quantity, v_pickup, v_drop, v_l.fragile, v_l.upright_only, v_l.stackable,
          'extra_load', v_x.id);

  update public.trip_extra_loads set status = 'accepted', pickup_stop_id = v_pickup, drop_stop_id = v_drop where id = v_x.id;
  update public.freight_listings set status = 'accepted', accepted_by_company = v_me where id = v_l.id;

  select code into v_code from public.trips where id = v_x.trip_id;
  insert into public.activity_log (company_id, kind, message, entity_type, entity_ref, meta)
  values (v_me, 'extra_load_accepted',
          'Extra load ' || v_l.code || ' accepted for ' || v_code || ': ' || v_l.pickup_name || ' → ' || v_l.drop_name,
          'listing', v_l.code, jsonb_build_object('trip_id', v_x.trip_id, 'trip_code', v_code, 'listing_code', v_l.code,
                                                  'pickup', v_l.pickup_name, 'drop', v_l.drop_name,
                                                  'net_benefit_inr', v_x.net_benefit_inr));

  return jsonb_build_object('pickup_stop_id', v_pickup, 'drop_stop_id', v_drop, 'pickup_seq', v_pick_seq, 'drop_seq', v_drop_seq);
end;
$$;

-- =====================================================================
-- LOADER LINK (no login). The owner creates a secret link per trip; it works for 48 h,
-- until the owner turns it off, or until the trip departs. Re-plans keep the same link.
-- =====================================================================
create or replace function public.create_loader_link(p_trip_id uuid)
returns jsonb language plpgsql security invoker as $$
declare
  v_token text := encode(gen_random_bytes(18), 'hex');
  v_exp   timestamptz := now() + interval '48 hours';
begin
  update public.trips
     set loader_token = v_token, loader_token_expires_at = v_exp, loader_link_enabled = true
   where id = p_trip_id;               -- RLS: only the owner's company can update
  if not found then raise exception 'TRIP_NOT_FOUND'; end if;
  return jsonb_build_object('token', v_token, 'expires_at', v_exp);
end;
$$;

create or replace function public.disable_loader_link(p_trip_id uuid)
returns void language sql security invoker as $$
  update public.trips set loader_link_enabled = false where id = p_trip_id;
$$;

-- internal: valid token → trip id + company id (null if invalid)
create or replace function public.loader_trip_for_token(p_token text)
returns table (trip_id uuid, company_id uuid)
language sql stable security definer set search_path = public as $$
  select t.id, t.company_id from public.trips t
  where t.loader_token = p_token
    and t.loader_link_enabled
    and t.loader_token_expires_at > now()
    and t.status in ('planned', 'loading');
$$;

-- everything the loader page needs in one call
create or replace function public.loader_get_job(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_trip uuid; v_company uuid; v_plan public.load_plans%rowtype; v_out jsonb;
begin
  select trip_id, company_id into v_trip, v_company from public.loader_trip_for_token(p_token);
  if v_trip is null then return jsonb_build_object('error', 'LINK_INVALID'); end if;
  select * into v_plan from public.load_plans where trip_id = v_trip and status = 'active' order by version desc limit 1;
  select jsonb_build_object(
    'company', (select name from public.companies where id = v_company),
    'trip', (select jsonb_build_object('id', t.id, 'code', t.code, 'status', t.status, 'expiresAt', t.loader_token_expires_at)
             from public.trips t where t.id = v_trip),
    'truck', (select jsonb_build_object('regNo', tr.reg_no, 'model', tr.model, 'lengthCm', tr.internal_length_cm,
                                        'widthCm', tr.internal_width_cm, 'heightCm', tr.internal_height_cm, 'payloadKg', tr.payload_kg)
              from public.trips t join public.trucks tr on tr.id = t.truck_id where t.id = v_trip),
    'stops', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'seq', s.seq, 'type', s.stop_type, 'name', s.name) order by s.seq)
                       from public.trip_stops s where s.trip_id = v_trip), '[]'::jsonb),
    'plan', case when v_plan.id is null then null else
            jsonb_build_object('id', v_plan.id, 'version', v_plan.version, 'placements', v_plan.placements, 'metrics', v_plan.metrics) end,
    'progress', coalesce((select jsonb_agg(jsonb_build_object('step', p.step_index, 'key', p.placement_key, 'status', p.status, 'note', p.note)
                                           order by p.step_index)
                          from public.loading_progress p where p.load_plan_id = v_plan.id), '[]'::jsonb)
  ) into v_out;
  return v_out;
end;
$$;

-- loader marks a step done / problem
create or replace function public.loader_update_step(p_token text, p_plan_id uuid, p_step int, p_status text, p_note text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_trip uuid; v_company uuid; v_code text;
begin
  select trip_id, company_id into v_trip, v_company from public.loader_trip_for_token(p_token);
  if v_trip is null then return jsonb_build_object('error', 'LINK_INVALID'); end if;
  if p_status not in ('pending', 'done', 'skipped', 'issue') then return jsonb_build_object('error', 'BAD_STATUS'); end if;
  if not exists (select 1 from public.load_plans where id = p_plan_id and trip_id = v_trip and status = 'active') then
    return jsonb_build_object('error', 'PLAN_CHANGED');
  end if;

  update public.loading_progress set status = p_status, note = coalesce(p_note, '')
   where load_plan_id = p_plan_id and step_index = p_step;
  update public.trips set status = 'loading' where id = v_trip and status = 'planned';

  if p_status = 'issue' then
    select code into v_code from public.trips where id = v_trip;
    insert into public.alerts (company_id, trip_id, kind, severity, title, message, meta)
    values (v_company, v_trip, 'loader_issue', 'warning', 'Loader reported a problem',
            v_code || ' step ' || p_step || ': ' || coalesce(p_note, ''),
            jsonb_build_object('code', v_code, 'step', p_step, 'note', coalesce(p_note, '')));
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- loader adds cargo rows (after confirming camera/voice suggestions on the loader page)
create or replace function public.loader_add_cargo(p_token text, p_items jsonb, p_source text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_trip uuid; v_company uuid; v_item jsonb; v_n int := 0; v_code text;
begin
  select trip_id, company_id into v_trip, v_company from public.loader_trip_for_token(p_token);
  if v_trip is null then return jsonb_build_object('error', 'LINK_INVALID'); end if;
  if p_source not in ('camera', 'voice') then return jsonb_build_object('error', 'BAD_SOURCE'); end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    return jsonb_build_object('error', 'BAD_ITEMS');
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    if not exists (select 1 from public.trip_stops where id = (v_item ->> 'dropStopId')::uuid and trip_id = v_trip) then
      return jsonb_build_object('error', 'BAD_DROP_STOP');
    end if;
    insert into public.cargo_items (company_id, trip_id, label, length_cm, width_cm, height_cm, weight_kg, quantity,
                                    drop_stop_id, fragile, upright_only, stackable, source, added_by_loader, image_path, confidence)
    values (v_company, v_trip, coalesce(nullif(v_item ->> 'label', ''), 'Box'),
            (v_item ->> 'lengthCm')::numeric, (v_item ->> 'widthCm')::numeric, (v_item ->> 'heightCm')::numeric,
            (v_item ->> 'weightKg')::numeric, coalesce((v_item ->> 'quantity')::int, 1),
            (v_item ->> 'dropStopId')::uuid,
            coalesce((v_item ->> 'fragile')::boolean, false), coalesce((v_item ->> 'uprightOnly')::boolean, false),
            coalesce((v_item ->> 'stackable')::boolean, true), p_source, true,
            v_item ->> 'imagePath', (v_item ->> 'confidence')::numeric);
    v_n := v_n + 1;
  end loop;

  select code into v_code from public.trips where id = v_trip;
  insert into public.alerts (company_id, trip_id, kind, severity, title, message, meta)
  values (v_company, v_trip, 'loader_cargo', 'info', 'Loader added cargo',
          v_code || ': ' || v_n || ' item line(s) added by ' || p_source || ' — re-plan the load',
          jsonb_build_object('code', v_code, 'count', v_n, 'source', p_source));
  return jsonb_build_object('ok', true, 'added', v_n);
end;
$$;

-- =====================================================================
-- SAMPLE DATA PER COMPANY — called by the app after a new owner's first login.
-- =====================================================================
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
                             driver_name, driver_phone, last_lat, last_lng, fuel_level_pct, is_sample) values
    (p_company, 'MP09 HG 4821', 'Tata Signa 3118.T · 32 ft MXL container', 'container', 975, 243, 243, 15000, 31000, 3, 3.6, 34, 'active', 'Indore', 'Ramesh Yadav', '+91 98270 00001', 28.3540, 76.9366, 72, true),
    (p_company, 'RJ14 GC 7735', 'Ashok Leyland 2820 · 24 ft closed body', 'closed', 732, 244, 244, 10000, 28000, 3, 4.2, 28, 'idle', 'Jaipur', 'Suresh Meena', '+91 98290 00002', 26.7787, 75.8306, 88, true),
    (p_company, 'GJ01 KT 2208', 'Eicher Pro 3015 · 19 ft closed body', 'closed', 579, 214, 214, 9000, 16000, 2, 5.5, 22, 'active', 'Ahmedabad', 'Vikram Patel', '+91 98250 00003', 22.3072, 73.1812, 54, true),
    (p_company, 'MH04 LQ 9913', 'BharatBenz 1617R · 22 ft container', 'container', 670, 244, 244, 9000, 16200, 2, 5.0, 25, 'maintenance', 'Mumbai', 'Anil Pawar', '+91 98200 00004', 19.2813, 73.0483, 40, true),
    (p_company, 'MP09 KR 1147', 'Tata 1412 LPT · 17 ft closed body', 'closed', 518, 213, 213, 7000, 14000, 2, 6.0, 20, 'offline', 'Indore', 'Mahesh Chouhan', '+91 98260 00005', 22.7196, 75.8577, 12, true),
    (p_company, 'RJ14 TB 3360', 'Tata Ultra 1918.T · 20 ft closed body', 'closed', 610, 229, 229, 9000, 18500, 2, 5.2, 24, 'active', 'Jaipur', 'Imran Khan', '+91 98290 00006', 23.5986, 72.9665, 61, true);

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

  insert into public.alerts (company_id, truck_id, kind, severity, title, message, is_sample, created_at) values
    (p_company, (select id from public.trucks where company_id = p_company and reg_no = 'RJ14 TB 3360'), 'route_deviation', 'warning', 'Route deviation',
     'RJ14 TB 3360 left the planned route on NH48 near Himmatnagar. Driver rerouted via SH.', true, now() - interval '25 minutes'),
    (p_company, (select id from public.trucks where company_id = p_company and reg_no = 'MP09 KR 1147'), 'engine_warning', 'critical', 'Engine warning',
     'MP09 KR 1147 reported a diagnostic warning. Inspection required before next trip.', true, now() - interval '50 minutes'),
    (p_company, (select id from public.trucks where company_id = p_company and reg_no = 'MP09 KR 1147'), 'low_fuel', 'critical', 'Critical fuel level',
     'MP09 KR 1147 fuel at 12%. Vehicle offline — refuel before dispatch.', true, now() - interval '70 minutes'),
    (p_company, tr_demo, 'city_entry', 'info', 'Mumbai no-entry window',
     'TRP-2026-0031 may reach Mumbai inside the 17:00–21:00 no-entry window. Check the route plan.', true, now() - interval '5 minutes');

  insert into public.activity_log (company_id, kind, message, entity_type, entity_ref, is_sample, created_at) values
    (p_company, 'trip_departed', 'Trip departed Ahmedabad (Aslali)', 'truck', 'GJ01 KT 2208', true, now() - interval '3 hours'),
    (p_company, 'stop_done', 'Delivered at Vadodara (Makarpura)', 'trip', 'TRP-2026-0029', true, now() - interval '20 minutes'),
    (p_company, 'fuel', 'Fuelled at Himmatnagar — 180 L', 'truck', 'RJ14 TB 3360', true, now() - interval '5 hours'),
    (p_company, 'trip_completed', 'Trip completed at Himmatnagar', 'trip', 'TRP-2026-0030', true, now() - interval '2 hours'),
    (p_company, 'alert_resolved', 'Geofence alert resolved', 'truck', 'RJ14 GC 7735', true, now() - interval '6 hours'),
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

revoke all on function public._seed_company(uuid) from public, anon, authenticated;

-- first login: create the caller's sample data once
create or replace function public.seed_sample_data()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_c uuid := public.current_company_id();
begin
  if v_c is null then raise exception 'NOT_SIGNED_IN'; end if;
  perform 1 from public.companies where id = v_c and sample_seeded_at is null for update;
  if not found then return jsonb_build_object('seeded', false); end if;
  perform public._seed_company(v_c);
  update public.companies set sample_seeded_at = now() where id = v_c;
  return jsonb_build_object('seeded', true);
end;
$$;

-- Settings → "Reset sample data": delete the caller's sample rows (and anything attached), recreate them
create or replace function public.reset_sample_data()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_c uuid := public.current_company_id();
begin
  if v_c is null then raise exception 'NOT_SIGNED_IN'; end if;
  update public.freight_listings set status = 'open', accepted_by_company = null
   where accepted_by_company = v_c and visibility = 'public';
  delete from public.trips where company_id = v_c and is_sample;          -- cascades stops, cargo, plans, routes, extra loads
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

-- sample trucks still used by the owner's own trips are kept; drop their duplicates before reseeding
create or replace function public._seed_company_missing_trucks_guard(p_company uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.trucks set reg_no = reg_no || ' (old)', is_sample = false
   where company_id = p_company and is_sample;
end;
$$;
revoke all on function public._seed_company_missing_trucks_guard(uuid) from public, anon, authenticated;

-- grants
grant execute on function public.current_company_id() to authenticated;
grant execute on function public.next_trip_code() to authenticated;
grant execute on function public.next_listing_code() to authenticated;
grant execute on function public.km_between(double precision, double precision, double precision, double precision) to authenticated, anon;
grant execute on function public.activate_load_plan(uuid) to authenticated;
grant execute on function public.accept_extra_load(uuid, int, int) to authenticated;
grant execute on function public.create_loader_link(uuid) to authenticated;
grant execute on function public.disable_loader_link(uuid) to authenticated;
grant execute on function public.seed_sample_data() to authenticated;
grant execute on function public.reset_sample_data() to authenticated;
revoke all on function public.loader_trip_for_token(text) from public, anon, authenticated;
grant execute on function public.loader_trip_for_token(text) to service_role;
grant execute on function public.loader_get_job(text) to anon, authenticated;
grant execute on function public.loader_update_step(text, uuid, int, text, text) to anon, authenticated;
grant execute on function public.loader_add_cargo(text, jsonb, text) to anon, authenticated;

-- ########################## PART 3 — GLOBAL SAMPLE DATA (route POIs, shared by all companies) ##########################
-- Approximate sample points on NH48; Phase 1B replaces/extends them with real data (is_sample = false).
begin;
delete from public.pois where is_sample;
insert into public.pois (kind, name, lat, lng, highway, city, state, data, source, is_sample) values
  ('toll', 'NH48 toll plaza near Shahjahanpur (sample)', 27.9950, 76.4300, 'NH48', 'Shahjahanpur', 'RJ', '{"rate_inr": {"2": 165, "3": 360, "4": 360, "5": 565, "6": 565}}', 'sample-approx', true),
  ('toll', 'NH48 toll plaza near Manoharpur (sample)', 27.3000, 75.9500, 'NH48', 'Manoharpur', 'RJ', '{"rate_inr": {"2": 150, "3": 330, "4": 330, "5": 520, "6": 520}}', 'sample-approx', true),
  ('toll', 'NH48 toll plaza near Kishangarh (sample)', 26.5600, 74.8200, 'NH48', 'Kishangarh', 'RJ', '{"rate_inr": {"2": 140, "3": 300, "4": 300, "5": 470, "6": 470}}', 'sample-approx', true),
  ('toll', 'NH48 toll plaza near Bhim (sample)', 25.7300, 74.0800, 'NH48', 'Bhim', 'RJ', '{"rate_inr": {"2": 155, "3": 340, "4": 340, "5": 535, "6": 535}}', 'sample-approx', true),
  ('toll', 'NH48 toll plaza near Karjan (sample)', 22.0500, 73.1200, 'NH48', 'Karjan', 'GJ', '{"rate_inr": {"2": 160, "3": 350, "4": 350, "5": 550, "6": 550}}', 'sample-approx', true),
  ('toll', 'NH48 toll plaza near Charoti (sample)', 19.8900, 72.9400, 'NH48', 'Charoti', 'MH', '{"rate_inr": {"2": 170, "3": 370, "4": 370, "5": 580, "6": 580}}', 'sample-approx', true),
  ('dhaba', 'Highway dhaba, Behror (sample)', 27.8860, 76.2860, 'NH48', 'Behror', 'RJ', '{"parking": true, "veg": true, "open_24h": true}', 'sample', true),
  ('dhaba', 'Highway dhaba, Beawar (sample)', 26.1100, 74.3300, 'NH48', 'Beawar', 'RJ', '{"parking": true, "veg": true, "open_24h": true}', 'sample', true),
  ('dhaba', 'Highway dhaba, Himmatnagar (sample)', 23.6100, 72.9800, 'NH48', 'Himmatnagar', 'GJ', '{"parking": true, "veg": true, "open_24h": true}', 'sample', true),
  ('dhaba', 'Highway dhaba, Bharuch (sample)', 21.7200, 73.0100, 'NH48', 'Bharuch', 'GJ', '{"parking": true, "veg": false, "open_24h": true}', 'sample', true),
  ('dhaba', 'Highway dhaba, Manor (sample)', 19.7300, 72.9200, 'NH48', 'Manor', 'MH', '{"parking": true, "veg": true, "open_24h": true}', 'sample', true),
  ('hotel', 'Truckers lodge, Udaipur bypass (sample)', 24.6100, 73.7500, 'NH48', 'Udaipur', 'RJ', '{"parking": true, "rooms": true}', 'sample', true),
  ('hotel', 'Truckers lodge, Vadodara (sample)', 22.3500, 73.2100, 'NH48', 'Vadodara', 'GJ', '{"parking": true, "rooms": true}', 'sample', true),
  ('parking', 'Truck parking, Kamrej (sample)', 21.2706, 72.9590, 'NH48', 'Surat', 'GJ', '{"secure": true}', 'sample', true),
  ('fuel', 'Fuel station, Kishangarh (sample)', 26.5800, 74.8400, 'NH48', 'Kishangarh', 'RJ', '{}', 'sample', true),
  ('fuel', 'Fuel station, Himmatnagar (sample)', 23.5900, 72.9600, 'NH48', 'Himmatnagar', 'GJ', '{}', 'sample', true),
  ('checkpoint', 'Rajasthan–Gujarat border check (sample)', 23.7600, 73.4000, 'NH48', 'Shamlaji', 'RJ/GJ', '{"avg_delay_min": 25, "border": "RJ-GJ"}', 'sample-approx', true),
  ('checkpoint', 'Gujarat–Maharashtra border check (sample)', 20.2500, 72.8800, 'NH48', 'Achhad', 'GJ/MH', '{"avg_delay_min": 20, "border": "GJ-MH"}', 'sample-approx', true),
  ('city_entry', 'Mumbai heavy-vehicle no-entry hours (sample)', 19.1500, 72.9500, '', 'Mumbai', 'MH', '{"no_entry": [["07:00", "11:00"], ["17:00", "21:00"]], "radius_km": 20}', 'sample', true),
  ('city_entry', 'Ahmedabad heavy-vehicle no-entry hours (sample)', 23.0225, 72.5714, '', 'Ahmedabad', 'GJ', '{"no_entry": [["08:00", "20:00"]], "radius_km": 12}', 'sample', true),
  ('city_entry', 'Jaipur heavy-vehicle no-entry hours (sample)', 26.9124, 75.7873, '', 'Jaipur', 'RJ', '{"no_entry": [["08:00", "22:00"]], "radius_km": 10}', 'sample', true);
commit;
