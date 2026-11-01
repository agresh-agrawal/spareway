-- Cargo data integrity (owner, 2026-11-01). Additive file; applied with the Supabase MCP.
-- Declared weights (typed, AI, voice, loader, provider) are checked against physics, the truck, the company's own
-- history and the weighbridge. The limits mirror src/features/cargo/lib/integrity.ts. The browser cannot skip them:
--  1. cargo_integrity_guard (BEFORE INSERT/UPDATE): refuses impossible lines, stores flags + status, keeps
--     source / AI confidence / loader / extra-load fields read-only for clients, locks cargo once the trip has left.
--  2. cargo_changes: append-only history of every change (who, old → new). Clients can only read it.
--  3. confirm_cargo_check(): the only way to mark a flagged line as checked (reason required, cleared on any edit).
--  4. trip_weighings: weighbridge slips. Net, declared total, match and the GPS distance to the loading point are
--     computed here, never sent by the client. Owner entries need a slip photo; the driver can enter one by link.
--  5. freight_listings: impossible weights for the size are refused (provider posts and owner posts).

-- ── helpers ────────────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public._cargo_label_key(p text)
returns text language sql immutable set search_path = public as $$
  select btrim(regexp_replace(lower(coalesce(p, '')), '[[:space:][:punct:]]+', ' ', 'g'));
$$;

create or replace function public._cargo_vague(p text)
returns boolean language sql immutable set search_path = public as $$
  with k as (select public._cargo_label_key(p) as k)
  select length(replace(k.k, ' ', '')) < 3
      or replace(k.k, ' ', '') ~ '^[0-9]+$'
      or not exists (
        select 1 from unnest(string_to_array(k.k, ' ')) w
        where w !~ '^[0-9]+$' and w not in (
          'goods','good','item','items','box','boxes','carton','cartons','package','packages','parcel','parcels',
          'misc','miscellaneous','other','others','stuff','things','material','materials','cargo','load','general',
          'test','testing','sample','na','n/a','none','xyz','abc','asdf','qwerty','unknown','any','etc',
          'maal','saman','samaan','saamaan','सामान','माल','डिब्बा','डिब्बे','पेटी','कार्टन'))
  from k;
$$;

-- ── cargo_items: stored result of the checks ──────────────────────────────────────────────────────────────────
alter table public.cargo_items
  add column if not exists integrity_flags text[] not null default '{}',
  add column if not exists integrity_status text not null default 'ok',
  add column if not exists evidence_path text,
  add column if not exists integrity_note text,
  add column if not exists integrity_confirmed_at timestamptz,
  add column if not exists integrity_confirmed_by uuid;
do $$ begin
  alter table public.cargo_items add constraint cargo_items_integrity_status_check check (integrity_status in ('ok', 'review', 'checked'));
exception when duplicate_object then null; end $$;
create index if not exists cargo_items_label_key_idx on public.cargo_items (company_id, public._cargo_label_key(label));

create or replace function public.cargo_integrity_guard()
returns trigger language plpgsql set search_path = public as $$
declare
  v_client boolean := current_user in ('authenticated', 'anon');
  v_status text;
  v_truck public.trucks;
  m3 numeric; dens numeric; vol numeric; hist numeric; n int;
  l numeric := new.length_cm; w numeric := new.width_cm; h numeric := new.height_cm;
  tl numeric; tw numeric; th numeric;
  flags text[] := '{}';
begin
  -- plain limits (same as the cargo form)
  if l > 2000 or w > 2000 or h > 2000 or new.weight_kg > 30000 or new.quantity > 5000 then
    raise exception 'BAD_ITEMS: CARGO_IMPOSSIBLE limits';
  end if;

  if v_client then
    if tg_op = 'INSERT' then
      if new.source not in ('manual', 'csv', 'camera', 'voice') or new.added_by_loader or new.extra_load_id is not null then
        raise exception 'BAD_SOURCE: CARGO_FIELD_LOCKED';
      end if;
      if new.source not in ('camera', 'voice') then new.confidence := null; end if;
      if new.image_path is not null and split_part(new.image_path, '/', 1) <> public.current_company_id()::text then
        raise exception 'BAD_ITEMS: CARGO_FIELD_LOCKED image';
      end if;
      new.integrity_note := null; new.integrity_confirmed_at := null; new.integrity_confirmed_by := null;
    else
      if new.source is distinct from old.source or new.confidence is distinct from old.confidence
         or new.added_by_loader is distinct from old.added_by_loader or new.extra_load_id is distinct from old.extra_load_id
         or new.trip_id is distinct from old.trip_id or new.company_id is distinct from old.company_id
         or new.image_path is distinct from old.image_path or new.created_at is distinct from old.created_at then
        raise exception 'BAD_ITEMS: CARGO_FIELD_LOCKED';
      end if;
      -- a "checked" mark only comes from confirm_cargo_check()
      new.integrity_note := old.integrity_note; new.integrity_confirmed_at := old.integrity_confirmed_at;
      new.integrity_confirmed_by := old.integrity_confirmed_by;
    end if;
    if new.evidence_path is not null and new.evidence_path is distinct from (case when tg_op = 'UPDATE' then old.evidence_path end)
       and (split_part(new.evidence_path, '/', 1) <> public.current_company_id()::text or split_part(new.evidence_path, '/', 2) <> 'evidence') then
      raise exception 'BAD_ITEMS: CARGO_FIELD_LOCKED evidence';
    end if;
    select status into v_status from public.trips where id = new.trip_id;
    if v_status in ('in_transit', 'completed', 'cancelled') then raise exception 'BAD_STATUS: CARGO_LOCKED'; end if;
  end if;

  -- physics: kg per m³ of one unit
  m3 := l * w * h / 1e6;
  dens := new.weight_kg / m3;
  if dens > 8000 then raise exception 'BAD_ITEMS: CARGO_IMPOSSIBLE density %', round(dens); end if;
  if dens < 2 then raise exception 'BAD_ITEMS: CARGO_IMPOSSIBLE density %', round(dens, 1); end if;
  if dens > 3000 then flags := array_append(flags, 'DENSITY_HIGH'); end if;
  if dens < 15 then flags := array_append(flags, 'DENSITY_LOW'); end if;

  -- the truck on this trip
  select t.* into v_truck from public.trips tr join public.trucks t on t.id = tr.truck_id where tr.id = new.trip_id;
  if found and v_truck.payload_kg > 0 then
    if new.weight_kg > v_truck.payload_kg then raise exception 'BAD_ITEMS: CARGO_IMPOSSIBLE over payload'; end if;
    if new.weight_kg * new.quantity > v_truck.payload_kg then flags := array_append(flags, 'LINE_OVER_PAYLOAD'); end if;
    tl := v_truck.internal_length_cm; tw := v_truck.internal_width_cm; th := v_truck.internal_height_cm;
    vol := tl * tw * th / 1e6;
    if m3 * new.quantity > vol then flags := array_append(flags, 'LINE_OVER_VOLUME'); end if;
    if not ((l <= tl and w <= tw and h <= th) or (w <= tl and l <= tw and h <= th)
            or (not new.upright_only and ((l <= tl and h <= tw and w <= th) or (w <= tl and h <= tw and l <= th)
                                          or (h <= tl and l <= tw and w <= th) or (h <= tl and w <= tw and l <= th)))) then
      flags := array_append(flags, 'NO_FIT');
    end if;
  end if;

  if public._cargo_vague(new.label) then flags := array_append(flags, 'VAGUE_LABEL'); end if;

  -- the company's own history for the same goods (other trips, at least 3 lines)
  select percentile_cont(0.5) within group (order by c.weight_kg), count(*) into hist, n
  from public.cargo_items c
  where c.company_id = new.company_id and c.trip_id <> new.trip_id
    and public._cargo_label_key(c.label) = public._cargo_label_key(new.label);
  if n >= 3 and hist > 0 and abs(new.weight_kg - hist) / hist > 0.6 then flags := array_append(flags, 'HISTORY_MISMATCH'); end if;

  if new.source in ('camera', 'voice') and new.confidence is not null and new.confidence < 0.5 then
    flags := array_append(flags, 'LOW_AI_CONFIDENCE');
  end if;

  -- any change to what was declared needs a new check
  if tg_op = 'UPDATE' and (new.label, new.length_cm, new.width_cm, new.height_cm, new.weight_kg, new.quantity)
                          is distinct from (old.label, old.length_cm, old.width_cm, old.height_cm, old.weight_kg, old.quantity) then
    new.integrity_note := null; new.integrity_confirmed_at := null; new.integrity_confirmed_by := null;
  end if;

  new.integrity_flags := flags;
  new.integrity_status := case
    when not (flags && array['DENSITY_HIGH', 'DENSITY_LOW', 'HISTORY_MISMATCH', 'LOW_AI_CONFIDENCE']) then 'ok'
    when new.evidence_path is not null or new.image_path is not null or new.integrity_confirmed_at is not null then 'checked'
    else 'review' end;
  return new;
end;
$$;
drop trigger if exists cargo_integrity_guard on public.cargo_items;
create trigger cargo_integrity_guard before insert or update on public.cargo_items
  for each row execute function public.cargo_integrity_guard();

-- deleting a line is locked the same way once the truck has left (a deleted trip / company cascades as the owner)
create or replace function public.cargo_delete_guard()
returns trigger language plpgsql set search_path = public as $$
declare v_status text;
begin
  if current_user in ('authenticated', 'anon') then
    select status into v_status from public.trips where id = old.trip_id;
    if v_status in ('in_transit', 'completed', 'cancelled') then raise exception 'BAD_STATUS: CARGO_LOCKED'; end if;
  end if;
  return old;
end;
$$;
drop trigger if exists cargo_delete_guard on public.cargo_items;
create trigger cargo_delete_guard before delete on public.cargo_items
  for each row execute function public.cargo_delete_guard();

-- ── cargo_changes: append-only history ─────────────────────────────────────────────────────────────────────────
-- No foreign keys on purpose: rows written while a trip or company is being deleted must not fail the delete.
create table if not exists public.cargo_changes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  trip_id uuid not null,
  cargo_item_id uuid not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  actor text not null check (actor in ('owner', 'loader', 'system')),
  actor_user uuid,
  label text not null default '',
  changes jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists cargo_changes_trip_idx on public.cargo_changes (trip_id, created_at desc);
create index if not exists cargo_changes_item_idx on public.cargo_changes (cargo_item_id, created_at desc);
alter table public.cargo_changes enable row level security;
drop policy if exists cargo_changes_select on public.cargo_changes;
create policy cargo_changes_select on public.cargo_changes for select to authenticated using (company_id = public.current_company_id());
revoke all on public.cargo_changes from anon, authenticated;
grant select on public.cargo_changes to authenticated;

create or replace function public._cargo_log_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r public.cargo_items := coalesce(new, old);
  d jsonb := '{}';
  f text;
  o jsonb; nw jsonb;
begin
  if tg_op = 'INSERT' and new.source = 'seed' then return new; end if;
  if tg_op = 'DELETE' and not exists (select 1 from public.trips where id = old.trip_id) then return old; end if;
  o := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  nw := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
  foreach f in array array['label', 'length_cm', 'width_cm', 'height_cm', 'weight_kg', 'quantity', 'drop_stop_id',
                           'fragile', 'upright_only', 'stackable', 'evidence_path', 'integrity_note'] loop
    if coalesce(o -> f, 'null'::jsonb) is distinct from coalesce(nw -> f, 'null'::jsonb) then
      d := d || jsonb_build_object(f, jsonb_build_array(o -> f, nw -> f));
    end if;
  end loop;
  if tg_op = 'UPDATE' and d = '{}'::jsonb then return new; end if;
  insert into public.cargo_changes (company_id, trip_id, cargo_item_id, action, actor, actor_user, label, changes)
  values (r.company_id, r.trip_id, r.id, lower(tg_op),
          case when auth.uid() is not null then 'owner' when r.added_by_loader then 'loader' else 'system' end,
          auth.uid(), r.label, d);
  return coalesce(new, old);
end;
$$;
revoke all on function public._cargo_log_change() from public, anon, authenticated;
drop trigger if exists cargo_log_change on public.cargo_items;
create trigger cargo_log_change after insert or update or delete on public.cargo_items
  for each row execute function public._cargo_log_change();

-- ── confirm a flagged line (owner, with a reason) ─────────────────────────────────────────────────────────────
create or replace function public.confirm_cargo_check(p_id uuid, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_item public.cargo_items; v_status text;
begin
  if auth.uid() is null then raise exception 'NOT_SIGNED_IN'; end if;
  select * into v_item from public.cargo_items where id = p_id and company_id = public.current_company_id();
  if not found then return jsonb_build_object('error', 'BAD_ITEMS'); end if;
  if length(btrim(coalesce(p_note, ''))) < 10 then return jsonb_build_object('error', 'BAD_ITEMS'); end if;
  select status into v_status from public.trips where id = v_item.trip_id;
  if v_status in ('in_transit', 'completed', 'cancelled') then return jsonb_build_object('error', 'BAD_STATUS'); end if;
  update public.cargo_items set integrity_note = left(btrim(p_note), 300), integrity_confirmed_at = now(),
         integrity_confirmed_by = auth.uid() where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.confirm_cargo_check(uuid, text) from public, anon;
grant execute on function public.confirm_cargo_check(uuid, text) to authenticated;

-- evidence photos / documents: the owner uploads to <company>/evidence/… in the private cargo-images bucket
drop policy if exists cargo_images_evidence_insert on storage.objects;
create policy cargo_images_evidence_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'cargo-images' and (storage.foldername(name))[1] = public.current_company_id()::text
              and (storage.foldername(name))[2] = 'evidence');

-- ── weighbridge slips ─────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.trip_weighings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id() references public.companies (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  gross_kg numeric not null check (gross_kg > 0 and gross_kg <= 100000),
  tare_kg numeric check (tare_kg > 0 and tare_kg <= 100000),
  net_kg numeric not null default 0,
  declared_kg numeric not null default 0,
  diff_kg numeric not null default 0,
  status text not null default 'mismatch' check (status in ('match', 'mismatch')),
  slip_path text,
  lat double precision, lng double precision, accuracy_m double precision,
  distance_km double precision,
  place_ok boolean not null default false,
  entered_by text not null default 'owner' check (entered_by in ('owner', 'driver')),
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists trip_weighings_trip_idx on public.trip_weighings (trip_id, created_at desc);
alter table public.trip_weighings enable row level security;
drop policy if exists trip_weighings_select on public.trip_weighings;
create policy trip_weighings_select on public.trip_weighings for select to authenticated using (company_id = public.current_company_id());
drop policy if exists trip_weighings_insert on public.trip_weighings;
create policy trip_weighings_insert on public.trip_weighings for insert to authenticated with check (company_id = public.current_company_id());
revoke all on public.trip_weighings from anon, authenticated;
grant select, insert (trip_id, gross_kg, tare_kg, slip_path, lat, lng, accuracy_m, note) on public.trip_weighings to authenticated;

-- runs as the caller (owner: RLS on trips / trucks / cargo; driver: inside driver_add_weighing)
create or replace function public.trip_weighing_compute()
returns trigger language plpgsql set search_path = public as $$
declare v_trip public.trips; v_truck public.trucks; tol numeric;
begin
  select * into v_trip from public.trips where id = new.trip_id;
  if not found then raise exception 'TRIP_NOT_FOUND'; end if;
  new.company_id := v_trip.company_id;
  if current_user = 'authenticated' then
    if v_trip.company_id <> public.current_company_id() then raise exception 'TRIP_NOT_FOUND'; end if;
    new.entered_by := 'owner';
    if new.slip_path is null or split_part(new.slip_path, '/', 1) <> v_trip.company_id::text
       or split_part(new.slip_path, '/', 2) <> 'evidence' then
      raise exception 'BAD_ITEMS: SLIP_NEEDED';
    end if;
  end if;
  select * into v_truck from public.trucks where id = v_trip.truck_id;
  if new.tare_kg is null and v_truck.gross_weight_kg > v_truck.payload_kg then
    new.tare_kg := v_truck.gross_weight_kg - v_truck.payload_kg;
  end if;
  if new.tare_kg is null or new.gross_kg <= new.tare_kg then raise exception 'BAD_ITEMS: WEIGHT_TARE'; end if;
  new.net_kg := new.gross_kg - new.tare_kg;
  select coalesce(sum(weight_kg * quantity), 0) into new.declared_kg from public.cargo_items where trip_id = new.trip_id;
  new.diff_kg := new.net_kg - new.declared_kg;
  tol := greatest(0.1 * new.declared_kg, 300);
  new.status := case when abs(new.diff_kg) <= tol then 'match' else 'mismatch' end;
  new.distance_km := null;
  if new.lat is not null and new.lng is not null then
    select min(public.km_between(new.lat, new.lng, s.lat, s.lng)) into new.distance_km
    from public.trip_stops s where s.trip_id = new.trip_id and s.stop_type in ('origin', 'pickup');
  end if;
  new.place_ok := coalesce(new.distance_km <= 30, false);
  new.created_at := now();
  return new;
end;
$$;
revoke all on function public.trip_weighing_compute() from public, anon, authenticated;
drop trigger if exists trip_weighing_compute on public.trip_weighings;
create trigger trip_weighing_compute before insert on public.trip_weighings
  for each row execute function public.trip_weighing_compute();

create or replace function public._notify_from_weighing()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_code text; v_sample boolean;
begin
  if new.status = 'match' and new.place_ok then return new; end if;
  select code, is_sample into v_code, v_sample from public.trips where id = new.trip_id;
  insert into public.notifications (company_id, trip_id, kind, severity, major, title, meta, link, is_sample)
  values (new.company_id, new.trip_id, 'weighing_check', 'warning', true,
          v_code || ': weighbridge ' || round(new.net_kg) || ' kg vs declared ' || round(new.declared_kg) || ' kg',
          jsonb_build_object('code', v_code, 'net', round(new.net_kg), 'declared', round(new.declared_kg),
                             'diff', round(new.diff_kg), 'match', new.status = 'match', 'placeOk', new.place_ok),
          '/trips/' || new.trip_id || '?step=cargo', coalesce(v_sample, false));
  return new;
end;
$$;
revoke all on function public._notify_from_weighing() from public, anon, authenticated;
drop trigger if exists trip_weighings_notify on public.trip_weighings;
create trigger trip_weighings_notify after insert on public.trip_weighings
  for each row execute function public._notify_from_weighing();

-- the driver enters the slip from the driver link (phone GPS; no photo upload without a login)
create or replace function public.driver_add_weighing(p_token text, p_gross numeric, p_tare numeric default null,
  p_lat double precision default null, p_lng double precision default null, p_accuracy double precision default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_trip public.trips; v_row public.trip_weighings;
begin
  select * into v_trip from public.trips where driver_token = p_token and driver_link_enabled and status <> 'cancelled';
  if not found then return jsonb_build_object('error', 'LINK_INVALID'); end if;
  if p_gross is null or p_gross <= 0 or p_gross > 100000 or (p_tare is not null and (p_tare <= 0 or p_tare >= p_gross)) then
    return jsonb_build_object('error', 'BAD_ITEMS');
  end if;
  begin
    insert into public.trip_weighings (company_id, trip_id, gross_kg, tare_kg, lat, lng, accuracy_m, entered_by)
    values (v_trip.company_id, v_trip.id, p_gross, p_tare, p_lat, p_lng, p_accuracy, 'driver')
    returning * into v_row;
  exception when others then return jsonb_build_object('error', 'BAD_ITEMS');
  end;
  return jsonb_build_object('ok', true, 'net', round(v_row.net_kg), 'declared', round(v_row.declared_kg),
                            'match', v_row.status = 'match', 'placeOk', v_row.place_ok);
end;
$$;
revoke all on function public.driver_add_weighing(text, numeric, numeric, double precision, double precision, double precision) from public;
grant execute on function public.driver_add_weighing(text, numeric, numeric, double precision, double precision, double precision) to anon, authenticated;

-- ── provider / owner market loads: refuse impossible weight for the size ──────────────────────────────────────
create or replace function public.listing_integrity_guard()
returns trigger language plpgsql set search_path = public as $$
declare dens numeric;
begin
  if tg_op = 'UPDATE' and (new.length_cm, new.width_cm, new.height_cm, new.weight_kg)
                          is not distinct from (old.length_cm, old.width_cm, old.height_cm, old.weight_kg) then
    return new;
  end if;
  dens := new.weight_kg / (new.length_cm * new.width_cm * new.height_cm / 1e6);
  if dens > 8000 or dens < 2 then raise exception 'BAD_ITEMS: CARGO_IMPOSSIBLE density %', round(dens, 1); end if;
  return new;
end;
$$;
drop trigger if exists listing_integrity_guard on public.freight_listings;
create trigger listing_integrity_guard before insert or update on public.freight_listings
  for each row execute function public.listing_integrity_guard();

-- existing lines get their flags (the guard runs as the migration owner, so no lock applies)
update public.cargo_items set label = label;
