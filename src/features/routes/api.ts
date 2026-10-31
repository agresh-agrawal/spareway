// The only place in routes that talks to Supabase. Reads trip, truck, stops, settings, route_options and
// pois (own company / global via RLS); calls the route-plan Edge Function only through its contract
// (Architecture 9.1); writes route_options, trips.selected_route_id (+ departure), stop ETAs, activity and the
// city_entry alert. Fixture mode (?fixture=seed, dev only) uses the seed, the real POIs and mocked routes.
import { getSupabase } from '@/lib/supabase'
import { AppError, toAppError } from '@/lib/errors'
import { fixtureDelay, fixtureStore, isFixtureMode } from '@/lib/fixtures'
import type { Json, Tables } from '@/types/database'
import type { CostBreakdown, RouteVariant } from '@/types/domain'
import type { LngLat } from './lib/line'
import type { PoiInput } from './lib/pois'
import type { RoutePlan } from './lib/schedule'

export type TripRow = Tables<'trips'>
export type TruckRow = Tables<'trucks'>
export type StopRow = Tables<'trip_stops'>
export type SettingsRow = Tables<'company_settings'>
export type RouteRow = Tables<'route_options'>

export interface RouteBasics {
  trip: TripRow
  truck: TruckRow
  stops: StopRow[]
  settings: SettingsRow
}

export async function fetchRouteBasics(tripId: string): Promise<RouteBasics> {
  if (isFixtureMode()) {
    const d = fixtureStore()
    const trip = d.trips.find((t) => t.id === tripId)
    const truck = trip && d.trucks.find((t) => t.id === trip.truck_id)
    if (!trip || !truck) throw new AppError('TRIP_NOT_FOUND')
    const stops = d.trip_stops.filter((s) => s.trip_id === tripId).sort((a, b) => a.seq - b.seq)
    return fixtureDelay({ trip, truck, stops, settings: d.settings })
  }
  const sb = getSupabase()
  const { data: trip, error } = await sb.from('trips').select('*').eq('id', tripId).maybeSingle()
  if (error) throw toAppError(error)
  if (!trip) throw new AppError('TRIP_NOT_FOUND')
  const [truck, stops, settings] = await Promise.all([
    sb.from('trucks').select('*').eq('id', trip.truck_id).maybeSingle(),
    sb.from('trip_stops').select('*').eq('trip_id', tripId).order('seq'),
    sb.from('company_settings').select('*').maybeSingle(),
  ])
  if (truck.error) throw toAppError(truck.error)
  if (stops.error) throw toAppError(stops.error)
  if (settings.error) throw toAppError(settings.error)
  if (!truck.data || !settings.data) throw new AppError('TRIP_NOT_FOUND')
  return { trip, truck: truck.data, stops: stops.data, settings: settings.data }
}

/** Saved routes of a trip, oldest first (fastest, shortest, no_tolls as saved). */
export async function fetchRouteOptions(tripId: string): Promise<RouteRow[]> {
  if (isFixtureMode())
    return fixtureDelay(fixtureStore().route_options.filter((r) => r.trip_id === tripId).sort((a, b) => a.created_at.localeCompare(b.created_at)))
  const { data, error } = await getSupabase().from('route_options').select('*').eq('trip_id', tripId).order('created_at')
  if (error) throw toAppError(error)
  return data
}

/** POIs inside the bbox [minLng, minLat, maxLng, maxLat] (tolls, dhabas, check posts, no-entry zones). */
export async function fetchPois(bbox: [number, number, number, number]): Promise<PoiInput[]> {
  const [minLng, minLat, maxLng, maxLat] = bbox
  if (isFixtureMode()) {
    const { loadFixturePois } = await import('./fixtures/poisFromSql')
    const all = await loadFixturePois()
    return fixtureDelay(all.filter((p) => p.lng >= minLng && p.lng <= maxLng && p.lat >= minLat && p.lat <= maxLat))
  }
  const { data, error } = await getSupabase()
    .from('pois')
    .select('id, kind, name, lat, lng, city, data')
    .gte('lng', minLng)
    .lte('lng', maxLng)
    .gte('lat', minLat)
    .lte('lat', maxLat)
    .limit(2000)
  if (error) throw toAppError(error)
  return data
}

/** route-plan request body (Architecture 9.1 / Engineering Reference 6.1). */
export function routePlanBody(trip: Pick<TripRow, 'id'>, truck: TruckRow, stops: StopRow[]) {
  const gross = Number(truck.gross_weight_kg) || Number(truck.payload_kg) * 2
  const axles = Math.max(2, Number(truck.axles) || 2)
  return {
    tripId: trip.id,
    coordinates: [...stops].sort((a, b) => a.seq - b.seq).map((s) => [s.lng, s.lat] as LngLat),
    variants: ['fastest', 'shortest', 'no_tolls'] as RouteVariant['variant'][],
    truck: {
      lengthM: Number(truck.internal_length_cm) / 100,
      widthM: Number(truck.internal_width_cm) / 100,
      heightM: Number(truck.internal_height_cm) / 100,
      weightT: Math.round(gross / 100) / 10,
      axleloadT: Math.round(gross / axles / 100) / 10,
    },
  }
}

type RoutePlanReply = { ok: true; data: { routes: RouteVariant[] } } | { ok: false; error: { code: string; message: string } }

/** Ask route-plan for the three routes. Errors: ORS_QUOTA, ORS_ERROR, AUTH_REQUIRED (→ AppError). */
export async function requestRoutes(trip: Pick<TripRow, 'id'>, truck: TruckRow, stops: StopRow[]): Promise<RouteVariant[]> {
  const body = routePlanBody(trip, truck, stops)
  if (isFixtureMode()) {
    const { fixtureRoutes } = await import('./fixtures/routeLines')
    return fixtureDelay(fixtureRoutes(body.coordinates), 400)
  }
  const { data, error } = await getSupabase().functions.invoke<RoutePlanReply>('route-plan', { body })
  let reply = data
  if (error) {
    // non-2xx: the function still answers { ok: false, error: { code } } in the body
    const ctx = (error as { context?: unknown }).context
    if (ctx instanceof Response) reply = (await ctx.json().catch(() => null)) as RoutePlanReply | null
    if (!reply) throw toAppError(error)
  }
  if (!reply) throw new AppError('ORS_ERROR')
  if (!reply.ok) throw toAppError({ message: reply.error.code })
  if (!Array.isArray(reply.data.routes) || reply.data.routes.length === 0) throw new AppError('ORS_ERROR')
  return reply.data.routes
}

/** Replace the trip's saved routes with fresh ones (the old ones were for other stops). */
export async function saveRoutes(tripId: string, routes: RouteVariant[]): Promise<RouteRow[]> {
  const rows = routes.map((r) => ({
    trip_id: tripId,
    variant: r.variant,
    provider: r.cached ? 'ors-cache' : 'ors',
    distance_km: r.distanceKm,
    duration_min: r.durationMin,
    geometry: r.geometry as unknown as Json,
  }))
  if (isFixtureMode()) {
    const d = fixtureStore()
    d.route_options = d.route_options.filter((r) => r.trip_id !== tripId)
    const trip = d.trips.find((t) => t.id === tripId)
    if (trip) trip.selected_route_id = null
    const now = Date.now()
    const saved: RouteRow[] = rows.map((r, i) => ({
      ...r,
      id: crypto.randomUUID(),
      company_id: d.company.id,
      profile: 'driving-hgv',
      toll_count: 0,
      toll_cost_inr: 0,
      fuel_cost_inr: 0,
      driver_cost_inr: 0,
      waiting_cost_inr: 0,
      checkpoint_count: 0,
      total_cost_inr: 0,
      score: 0,
      halts: [],
      warnings: [],
      is_selected: false,
      created_at: new Date(now + i).toISOString(),
    }))
    d.route_options.push(...saved)
    return fixtureDelay(saved)
  }
  const sb = getSupabase()
  // deleting the selected one clears trips.selected_route_id (on delete set null)
  const { error: dErr } = await sb.from('route_options').delete().eq('trip_id', tripId)
  if (dErr) throw toAppError(dErr)
  const { data, error } = await sb.from('route_options').insert(rows).select('*')
  if (error) throw toAppError(error)
  return [...data].sort((a, b) => routes.findIndex((r) => r.variant === a.variant) - routes.findIndex((r) => r.variant === b.variant))
}

export interface ChooseInput {
  trip: Pick<TripRow, 'id' | 'code' | 'truck_id' | 'planned_departure'>
  routeId: string
  variant: RouteVariant['variant']
  distanceKm: number
  departure: string
  plan: RoutePlan
  cost: CostBreakdown
}

/**
 * "Choose": this route selected (others not), its costs + halts + warnings saved, the trip's selected route
 * (and departure, when it had none), stop ETAs, a `route_chosen` activity and — when the route waits for
 * no-entry hours — one `city_entry` alert with meta {code, city, from, to, wait}.
 */
export async function chooseRoute(input: ChooseInput): Promise<void> {
  const { trip, routeId, plan, cost } = input
  const routeUpdate = {
    is_selected: true,
    toll_count: cost.tollCount,
    toll_cost_inr: cost.tollsInr,
    fuel_cost_inr: cost.fuelInr,
    driver_cost_inr: cost.driverInr,
    waiting_cost_inr: cost.waitingInr,
    checkpoint_count: cost.checkpointCount,
    total_cost_inr: cost.totalInr,
    score: cost.score,
    halts: plan.schedule.halts as unknown as Json,
    warnings: plan.schedule.warnings as unknown as Json,
  }
  const km = Math.round(input.distanceKm)
  const activity = {
    kind: 'route_chosen',
    message: `Route chosen for ${trip.code}: ${input.variant.replace('_', ' ')}, ${km} km`,
    entity_type: 'trip',
    entity_ref: trip.code,
    meta: { code: trip.code, variant: input.variant, km },
  }
  const wait = plan.schedule.warnings.find((w) => w.code === 'NO_ENTRY')
  const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  const alert = wait && {
    kind: 'city_entry',
    severity: 'info',
    title: `${trip.code} reaches ${wait.city} in no-entry hours`,
    message: wait.message,
    trip_id: trip.id,
    truck_id: trip.truck_id,
    meta: {
      code: trip.code,
      city: wait.city,
      from: hhmm(wait.from),
      to: hhmm(wait.until),
      wait: `${Math.floor(wait.waitMin / 60)} h ${wait.waitMin % 60} min`,
    },
  }
  const tripUpdate: Partial<TripRow> = { selected_route_id: routeId }
  if (!trip.planned_departure) tripUpdate.planned_departure = input.departure

  if (isFixtureMode()) {
    const d = fixtureStore()
    for (const r of d.route_options) if (r.trip_id === trip.id) r.is_selected = false
    const row = d.route_options.find((r) => r.id === routeId)
    if (!row) throw new AppError('TRIP_NOT_FOUND')
    Object.assign(row, routeUpdate)
    Object.assign(d.trips.find((t) => t.id === trip.id) ?? {}, tripUpdate)
    for (const e of plan.schedule.stopEtas) {
      const s = d.trip_stops.find((x) => x.id === e.stopId)
      if (s) s.eta = e.eta
    }
    const now = new Date().toISOString()
    d.activity_log.push({ ...activity, id: crypto.randomUUID(), company_id: d.company.id, is_sample: false, created_at: now })
    if (alert) d.alerts.push({ ...alert, id: crypto.randomUUID(), company_id: d.company.id, is_sample: false, resolved: false, resolved_at: null, created_at: now })
    return fixtureDelay(undefined)
  }

  const sb = getSupabase()
  const steps = [
    () => sb.from('route_options').update({ is_selected: false }).eq('trip_id', trip.id),
    () => sb.from('route_options').update(routeUpdate).eq('id', routeId),
    () => sb.from('trips').update(tripUpdate).eq('id', trip.id),
    ...plan.schedule.stopEtas.map((e) => () => sb.from('trip_stops').update({ eta: e.eta }).eq('id', e.stopId)),
    () => sb.from('activity_log').insert(activity),
    ...(alert ? [() => sb.from('alerts').insert(alert)] : []),
  ]
  for (const run of steps) {
    const { error } = await run()
    if (error) throw toAppError(error)
  }
}
