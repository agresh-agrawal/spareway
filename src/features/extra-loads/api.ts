// The only place in extra-loads that talks to Supabase. Reads trip, truck, stops, settings, cargo, the active
// plan + loading progress, the chosen route line and open listings (own + everyone's public); writes
// trip_extra_loads, calls accept_extra_load, saves + activates the new load plan, posts / removes listings.
// Fixture mode (?fixture=seed, dev only) copies what the SQL does in the in-memory seed.
import { getSupabase } from '@/lib/supabase'
import { AppError, toAppError } from '@/lib/errors'
import { FIXTURE_COMPANY_ID, fixtureDelay, fixtureStore, isFixtureMode } from '@/lib/fixtures'
import { kmBetween } from '@/lib/geo'
import type { Json, Tables } from '@/types/database'
import type { GeoLineString, PackResult } from '@/types/domain'
import type { Candidate } from './lib/candidates'

export type TripRow = Tables<'trips'>
export type TruckRow = Tables<'trucks'>
export type StopRow = Tables<'trip_stops'>
export type CargoRow = Tables<'cargo_items'>
export type PlanRow = Tables<'load_plans'>
export type ListingRow = Tables<'freight_listings'>
export type SettingsRow = Tables<'company_settings'>

export interface StepData {
  trip: TripRow
  truck: TruckRow
  stops: StopRow[]
  settings: SettingsRow
  cargo: CargoRow[]
  activePlan: PlanRow | null
  /** loading progress steps already done on the active plan */
  loadedKeys: string[]
  /** chosen route line, or null (→ approximate line through the stops) */
  routeLine: GeoLineString | null
  listings: ListingRow[]
}

const OPEN = ['open', 'reserved']

export async function fetchStepData(tripId: string): Promise<StepData> {
  if (isFixtureMode()) {
    const d = fixtureStore()
    const trip = d.trips.find((t) => t.id === tripId)
    const truck = trip && d.trucks.find((t) => t.id === trip.truck_id)
    if (!trip || !truck) throw new AppError('TRIP_NOT_FOUND')
    const activePlan = d.load_plans.find((p) => p.trip_id === tripId && p.status === 'active') ?? null
    const route = d.route_options.find((r) => r.id === trip.selected_route_id)
    return fixtureDelay({
      trip,
      truck,
      stops: d.trip_stops.filter((s) => s.trip_id === tripId).sort((a, b) => a.seq - b.seq),
      settings: d.settings,
      cargo: d.cargo_items.filter((c) => c.trip_id === tripId),
      activePlan,
      loadedKeys: activePlan ? d.loading_progress.filter((r) => r.load_plan_id === activePlan.id && r.status === 'done').map((r) => r.placement_key) : [],
      routeLine: (route?.geometry as unknown as GeoLineString) ?? null,
      listings: d.freight_listings.filter((l) => OPEN.includes(l.status)),
    })
  }
  const sb = getSupabase()
  const { data: trip, error } = await sb.from('trips').select('*').eq('id', tripId).maybeSingle()
  if (error) throw toAppError(error)
  if (!trip) throw new AppError('TRIP_NOT_FOUND')
  const [truck, stops, settings, cargo, plan, route, listings] = await Promise.all([
    sb.from('trucks').select('*').eq('id', trip.truck_id).maybeSingle(),
    sb.from('trip_stops').select('*').eq('trip_id', tripId).order('seq'),
    sb.from('company_settings').select('*').maybeSingle(),
    sb.from('cargo_items').select('*').eq('trip_id', tripId),
    sb.from('load_plans').select('*').eq('trip_id', tripId).eq('status', 'active').maybeSingle(),
    trip.selected_route_id
      ? sb.from('route_options').select('geometry').eq('id', trip.selected_route_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    sb.from('freight_listings').select('*').in('status', OPEN).order('created_at'),
  ])
  for (const r of [truck, stops, settings, cargo, plan, route, listings]) if (r.error) throw toAppError(r.error)
  if (!truck.data || !settings.data) throw new AppError('TRIP_NOT_FOUND')
  let loadedKeys: string[] = []
  if (plan.data) {
    const { data, error: pErr } = await sb.from('loading_progress').select('placement_key').eq('load_plan_id', plan.data.id).eq('status', 'done')
    if (pErr) throw toAppError(pErr)
    loadedKeys = data.map((r) => r.placement_key)
  }
  return {
    trip,
    truck: truck.data,
    stops: stops.data ?? [],
    settings: settings.data,
    cargo: cargo.data ?? [],
    activePlan: plan.data,
    loadedKeys,
    routeLine: (route.data?.geometry as unknown as GeoLineString) ?? null,
    listings: listings.data ?? [],
  }
}

/** Save the candidate as a trip_extra_loads row (status suggested) and return its id. */
export async function saveSuggestion(tripId: string, c: Candidate): Promise<string> {
  const row = {
    trip_id: tripId,
    listing_id: c.listingId,
    status: 'suggested',
    detour_km: c.detourKm,
    detour_min: c.detourMin,
    cost_breakdown: c.cost as unknown as Json,
    incremental_cost_inr: c.cost.totalInr,
    net_benefit_inr: c.netBenefitInr,
    min_viable_rate_inr: c.minViableRateInr,
    feasibility: c.feasibility as unknown as Json,
  }
  if (isFixtureMode()) {
    const d = fixtureStore()
    const existing = d.trip_extra_loads.find((x) => x.trip_id === tripId && x.listing_id === c.listingId)
    if (existing?.status === 'accepted') throw new AppError('ALREADY_ACCEPTED')
    if (existing) {
      Object.assign(existing, row)
      return fixtureDelay(existing.id)
    }
    const id = crypto.randomUUID()
    d.trip_extra_loads.push({ ...row, id, company_id: d.company.id, pickup_stop_id: null, drop_stop_id: null, created_at: new Date().toISOString() })
    return fixtureDelay(id)
  }
  const sb = getSupabase()
  const { data: existing, error: eErr } = await sb
    .from('trip_extra_loads')
    .select('id, status')
    .eq('trip_id', tripId)
    .eq('listing_id', c.listingId)
    .maybeSingle()
  if (eErr) throw toAppError(eErr)
  if (existing?.status === 'accepted') throw new AppError('ALREADY_ACCEPTED')
  if (existing) {
    const { error } = await sb.from('trip_extra_loads').update(row).eq('id', existing.id)
    if (error) throw toAppError(error)
    return existing.id
  }
  const { data, error } = await sb.from('trip_extra_loads').insert(row).select('id').single()
  if (error) throw toAppError(error)
  return data.id
}

export interface AcceptResult {
  pickup_stop_id: string
  drop_stop_id: string
  pickup_seq: number
  drop_seq: number
}

/** accept_extra_load: adds / reuses stops (2 km), adds the cargo, marks the listing taken, writes activity. */
export async function acceptExtraLoad(extraLoadId: string, pickupAfterSeq: number, dropAfterSeq: number): Promise<AcceptResult> {
  if (isFixtureMode()) return fixtureDelay(fixtureAccept(extraLoadId, pickupAfterSeq, dropAfterSeq))
  const { data, error } = await getSupabase().rpc('accept_extra_load', {
    p_extra_load_id: extraLoadId,
    p_pickup_after_seq: pickupAfterSeq,
    p_drop_after_seq: dropAfterSeq,
  })
  if (error) throw toAppError(error)
  return data as unknown as AcceptResult
}

/** Same steps as SQL accept_extra_load, on the fixture store. */
function fixtureAccept(extraLoadId: string, pickupAfter: number, dropAfterIn: number): AcceptResult {
  const d = fixtureStore()
  const x = d.trip_extra_loads.find((r) => r.id === extraLoadId)
  if (!x) throw new AppError('EXTRA_LOAD_NOT_FOUND')
  if (x.status === 'accepted') throw new AppError('ALREADY_ACCEPTED')
  if (dropAfterIn < pickupAfter) throw new AppError('DROP_BEFORE_PICKUP')
  const l = d.freight_listings.find((r) => r.id === x.listing_id)
  if (!l) throw new AppError('LISTING_NOT_FOUND')
  if (!OPEN.includes(l.status)) throw new AppError('LISTING_NOT_OPEN')
  const tripStops = () => d.trip_stops.filter((s) => s.trip_id === x.trip_id)
  const now = new Date().toISOString()
  const newStop = (seq: number, type: string, name: string, lat: number, lng: number, windowEnd: string | null): StopRow => ({
    id: crypto.randomUUID(),
    company_id: d.company.id,
    trip_id: x.trip_id,
    seq,
    stop_type: type,
    name,
    city: name,
    lat,
    lng,
    window_start: null,
    window_end: windowEnd,
    eta: null,
    status: 'pending',
    created_at: now,
  })
  let dropAfter = dropAfterIn
  let pickup = tripStops()
    .filter((s) => kmBetween(s.lat, s.lng, l.pickup_lat, l.pickup_lng) <= 2)
    .sort((a, b) => a.seq - b.seq)[0]
  if (!pickup) {
    for (const s of tripStops()) if (s.seq > pickupAfter) s.seq += 1
    pickup = newStop(pickupAfter + 1, 'pickup', l.pickup_name, l.pickup_lat, l.pickup_lng, null)
    d.trip_stops.push(pickup)
    if (dropAfter >= pickupAfter) dropAfter += 1
  }
  let drop = tripStops()
    .filter((s) => s.seq > pickup.seq && kmBetween(s.lat, s.lng, l.drop_lat, l.drop_lng) <= 2)
    .sort((a, b) => a.seq - b.seq)[0]
  if (!drop) {
    if (dropAfter < pickup.seq) dropAfter = pickup.seq
    for (const s of tripStops()) if (s.seq > dropAfter) s.seq += 1
    drop = newStop(dropAfter + 1, 'drop', l.drop_name, l.drop_lat, l.drop_lng, l.deliver_by)
    d.trip_stops.push(drop)
  }
  d.cargo_items.push({
    id: crypto.randomUUID(),
    company_id: d.company.id,
    trip_id: x.trip_id,
    label: `${l.goods_type} (${l.code})`,
    sku: '',
    client_name: l.shipper_name,
    length_cm: l.length_cm,
    width_cm: l.width_cm,
    height_cm: l.height_cm,
    weight_kg: l.weight_kg,
    quantity: l.quantity,
    pickup_stop_id: pickup.id,
    drop_stop_id: drop.id,
    fragile: l.fragile,
    upright_only: l.upright_only,
    stackable: l.stackable,
    max_top_load_kg: null,
    priority: 'normal',
    source: 'extra_load',
    added_by_loader: false,
    extra_load_id: x.id,
    image_path: null,
    confidence: null,
    created_at: now,
  })
  Object.assign(x, { status: 'accepted', pickup_stop_id: pickup.id, drop_stop_id: drop.id })
  Object.assign(l, { status: 'accepted', accepted_by_company: d.company.id })
  const trip = d.trips.find((t) => t.id === x.trip_id)
  d.activity_log.push({
    id: crypto.randomUUID(),
    company_id: d.company.id,
    kind: 'extra_load_accepted',
    message: `Extra load ${l.code} accepted for ${trip?.code}: ${l.pickup_name} → ${l.drop_name}`,
    entity_type: 'listing',
    entity_ref: l.code,
    meta: { trip_id: x.trip_id, trip_code: trip?.code ?? '', listing_code: l.code, pickup: l.pickup_name, drop: l.drop_name, net_benefit_inr: x.net_benefit_inr },
    is_sample: false,
    created_at: now,
  })
  return { pickup_stop_id: pickup.id, drop_stop_id: drop.id, pickup_seq: pickup.seq, drop_seq: drop.seq }
}

/** Save the new plan as the next version and activate it (activate_load_plan); anything that didn't fit is listed on the plan. */
export async function saveAndActivatePlan(trip: Pick<TripRow, 'id' | 'code' | 'truck_id'>, result: PackResult): Promise<PlanRow> {
  const row = {
    trip_id: trip.id,
    status: 'draft',
    engine_version: result.engineVersion,
    input_hash: result.inputHash,
    placements: result.placements as unknown as Json,
    unplaced: result.unplaced as unknown as Json,
    metrics: result.metrics as unknown as Json,
  }
  if (isFixtureMode()) {
    const d = fixtureStore()
    const now = new Date().toISOString()
    const version = d.load_plans.filter((p) => p.trip_id === trip.id).reduce((m, p) => Math.max(m, p.version), 0) + 1
    const saved: PlanRow = { ...row, id: crypto.randomUUID(), company_id: d.company.id, version, created_by: d.profile.id, created_at: now }
    d.load_plans.push(saved)
    for (const p of d.load_plans) if (p.trip_id === trip.id && p.id !== saved.id && p.status === 'active') p.status = 'superseded'
    saved.status = 'active'
    d.loading_progress = d.loading_progress.filter((r) => r.load_plan_id !== saved.id)
    for (const pl of result.placements)
      d.loading_progress.push({ id: crypto.randomUUID(), company_id: d.company.id, load_plan_id: saved.id, step_index: pl.step, placement_key: pl.key, status: 'pending', note: '', updated_at: now })
    const vol = String(result.metrics.volumeUsedPct)
    d.activity_log.push({
      id: crypto.randomUUID(),
      company_id: d.company.id,
      kind: 'plan_activated',
      message: `Load plan v${version} activated (${vol}% space used)`,
      entity_type: 'trip',
      entity_ref: trip.code,
      meta: { plan_id: saved.id, version, volumeUsedPct: vol },
      is_sample: false,
      created_at: now,
    })
    return fixtureDelay(saved)
  }
  const sb = getSupabase()
  const { data: last, error: vErr } = await sb.from('load_plans').select('version').eq('trip_id', trip.id).order('version', { ascending: false }).limit(1).maybeSingle()
  if (vErr) throw toAppError(vErr)
  const { data: user } = await sb.auth.getUser()
  const { data, error } = await sb
    .from('load_plans')
    .insert({ ...row, version: (last?.version ?? 0) + 1, created_by: user.user?.id ?? null })
    .select('*')
    .single()
  if (error) throw toAppError(error)
  const { error: actErr } = await sb.rpc('activate_load_plan', { p_plan_id: data.id })
  if (actErr) throw toAppError(actErr)
  return { ...data, status: 'active' }
}

// ---------- marketplace ----------

export type ListingFilter = 'open' | 'taken' | 'all'

/** Listings I can see: my own (incl. demo copies) + everyone's public ones. */
export async function fetchListings(filter: ListingFilter): Promise<ListingRow[]> {
  const want = (s: string) => (filter === 'open' ? OPEN.includes(s) : filter === 'taken' ? s === 'accepted' : true)
  if (isFixtureMode()) return fixtureDelay(fixtureStore().freight_listings.filter((l) => want(l.status)).sort((a, b) => b.created_at.localeCompare(a.created_at) || a.code.localeCompare(b.code)))
  let q = getSupabase().from('freight_listings').select('*')
  if (filter === 'open') q = q.in('status', OPEN)
  if (filter === 'taken') q = q.eq('status', 'accepted')
  const { data, error } = await q.order('created_at', { ascending: false }).order('code').limit(200)
  if (error) throw toAppError(error)
  return data
}

export function myCompanyId(authCompanyId: string | null | undefined): string | null {
  return isFixtureMode() ? FIXTURE_COMPANY_ID : (authCompanyId ?? null)
}

export interface NewListing {
  shipper_name: string
  shipper_phone: string
  goods_type: string
  pickup: { name: string; lat: number; lng: number }
  drop: { name: string; lat: number; lng: number }
  length_cm: number
  width_cm: number
  height_cm: number
  weight_kg: number
  quantity: number
  fragile: boolean
  offered_rate_inr: number
  ready_from: string
}

/** Post a public load; code from next_listing_code() (LD-2001…). */
export async function postListing(input: NewListing): Promise<ListingRow> {
  const row = {
    visibility: 'public',
    shipper_name: input.shipper_name,
    shipper_phone: input.shipper_phone,
    goods_type: input.goods_type,
    description: '',
    pickup_name: input.pickup.name,
    pickup_lat: input.pickup.lat,
    pickup_lng: input.pickup.lng,
    drop_name: input.drop.name,
    drop_lat: input.drop.lat,
    drop_lng: input.drop.lng,
    length_cm: input.length_cm,
    width_cm: input.width_cm,
    height_cm: input.height_cm,
    weight_kg: input.weight_kg,
    quantity: input.quantity,
    fragile: input.fragile,
    upright_only: false,
    stackable: !input.fragile,
    offered_rate_inr: input.offered_rate_inr,
    ready_from: input.ready_from,
    deliver_by: null,
    status: 'open',
  }
  if (isFixtureMode()) {
    const d = fixtureStore()
    const max = d.freight_listings
      .filter((l) => l.company_id === d.company.id && /^LD-\d+$/.test(l.code))
      .reduce((m, l) => Math.max(m, Number(l.code.slice(3))), 2000)
    const code = `LD-${max + 1}`
    const saved: ListingRow = {
      ...row,
      id: crypto.randomUUID(),
      company_id: d.company.id,
      code,
      posted_by: d.profile.id,
      accepted_by_company: null,
      is_sample: false,
      created_at: new Date().toISOString(),
    }
    d.freight_listings.push(saved)
    return fixtureDelay(saved)
  }
  const sb = getSupabase()
  const { data: code, error: cErr } = await sb.rpc('next_listing_code')
  if (cErr) throw toAppError(cErr)
  const { data: user } = await sb.auth.getUser()
  const { data, error } = await sb
    .from('freight_listings')
    .insert({ ...row, code: String(code), posted_by: user.user?.id ?? null })
    .select('*')
    .single()
  if (error) throw toAppError(error)
  return data
}

/** Remove one of my own open posts. */
export async function removeListing(id: string): Promise<void> {
  if (isFixtureMode()) {
    const d = fixtureStore()
    d.freight_listings = d.freight_listings.filter((l) => !(l.id === id && l.company_id === d.company.id && OPEN.includes(l.status)))
    return fixtureDelay(undefined)
  }
  const { error } = await getSupabase().from('freight_listings').delete().eq('id', id).in('status', OPEN)
  if (error) throw toAppError(error)
}

/** Planned / loading trips with their stops (to find a trip for a load, and for the Home widget). */
export async function fetchPlannableTripsWithStops(): Promise<{ trip: TripRow; stops: StopRow[] }[]> {
  if (isFixtureMode()) {
    const d = fixtureStore()
    return fixtureDelay(
      d.trips
        .filter((t) => t.status === 'planned' || t.status === 'loading')
        .sort((a, b) => (a.planned_departure ?? '').localeCompare(b.planned_departure ?? ''))
        .map((trip) => ({ trip, stops: d.trip_stops.filter((s) => s.trip_id === trip.id).sort((a, b) => a.seq - b.seq) })),
    )
  }
  const sb = getSupabase()
  const { data: trips, error } = await sb.from('trips').select('*').in('status', ['planned', 'loading']).order('planned_departure', { ascending: true, nullsFirst: false })
  if (error) throw toAppError(error)
  if (trips.length === 0) return []
  const { data: stops, error: sErr } = await sb.from('trip_stops').select('*').in('trip_id', trips.map((t) => t.id)).order('seq')
  if (sErr) throw toAppError(sErr)
  return trips.map((trip) => ({ trip, stops: stops.filter((s) => s.trip_id === trip.id) }))
}
