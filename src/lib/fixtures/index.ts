// Dev fixture mode (Architecture 4.6): `?fixture=seed` in a dev build feeds the Engineering Reference 7
// sample data instead of Supabase, with a fake signed-in owner. Never active in production builds.
// Feature api.ts files: `if (isFixtureMode()) return …fixtureStore()…` before calling supabase-js.
import type { Tables } from '@/types/database'
import { buildSeed, FIXTURE_COMPANY_ID, FIXTURE_USER_ID, type FixtureData } from './seed'

const KEY = 'spareway.fixture'

/** True in dev builds when the URL has ?fixture=seed (kept for the browser tab until ?fixture=off). */
export function isFixtureMode(): boolean {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false
  const p = new URLSearchParams(window.location.search).get('fixture')
  try {
    if (p === 'seed') sessionStorage.setItem(KEY, 'seed')
    if (p === 'off') sessionStorage.removeItem(KEY)
    return sessionStorage.getItem(KEY) === 'seed'
  } catch {
    return p === 'seed'
  }
}

export function exitFixtureMode() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* storage blocked */
  }
}

let store: FixtureData | null = null

/** The in-memory fixture database for this tab (mutations stay until reload). */
export function fixtureStore(): FixtureData {
  if (!store) store = buildSeed()
  return store
}

/** Fresh copy of the seed (tests, "reset demo data" in fixture mode). */
export function resetFixtureStore(now?: Date): FixtureData {
  store = buildSeed(now)
  return store
}

/** Small delay so loading states show in fixture mode like on a real network. */
export function fixtureDelay<T>(value: T, ms = 150): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), ms))
}

// ---------- the three views, computed like the SQL views ----------

export function fixtureDashboardStats(d: FixtureData = fixtureStore()): Tables<'dashboard_stats'> {
  const active = d.load_plans.filter((p) => p.status === 'active')
  const vols = active.map((p) => Number((p.metrics as { volumeUsedPct?: number }).volumeUsedPct)).filter(Number.isFinite)
  const done = d.trip_stops.filter((s) => s.status === 'done' && s.eta && s.window_end)
  const onTime = done.filter((s) => new Date(s.eta!).getTime() <= new Date(s.window_end!).getTime())
  return {
    active_trucks: d.trucks.filter((t) => t.status === 'active').length,
    total_trucks: d.trucks.length,
    drivers_on_duty: d.trucks.filter((t) => t.driver_name && (t.status === 'active' || t.status === 'idle')).length,
    total_drivers: d.trucks.filter((t) => t.driver_name).length,
    live_trips: d.trips.filter((t) => t.status === 'loading' || t.status === 'in_transit').length,
    avg_utilisation_pct: vols.length ? Math.round((vols.reduce((a, b) => a + b, 0) / vols.length) * 10) / 10 : null,
    on_time_pct: done.length ? Math.round((1000 * onTime.length) / done.length) / 10 : null,
  }
}

export function fixtureTripOverview(d: FixtureData = fixtureStore()): Tables<'trip_overview'>[] {
  return d.trips.map((t) => {
    const truck = d.trucks.find((x) => x.id === t.truck_id)!
    const stops = d.trip_stops.filter((s) => s.trip_id === t.id).sort((a, b) => a.seq - b.seq)
    const cargo = d.cargo_items.filter((c) => c.trip_id === t.id)
    const plan = d.load_plans
      .filter((p) => p.trip_id === t.id && p.status === 'active')
      .sort((a, b) => b.version - a.version)[0]
    const route = d.route_options.find((r) => r.id === t.selected_route_id)
    const m = (plan?.metrics ?? {}) as { volumeUsedPct?: number; weightUsedPct?: number }
    return {
      id: t.id,
      company_id: t.company_id,
      code: t.code,
      status: t.status,
      planned_departure: t.planned_departure,
      actual_departure: t.actual_departure,
      base_freight_inr: t.base_freight_inr,
      truck_id: t.truck_id,
      reg_no: truck.reg_no,
      model: truck.model,
      payload_kg: truck.payload_kg,
      truck_volume_m3: (truck.internal_length_cm * truck.internal_width_cm * truck.internal_height_cm) / 1e6,
      origin_name: stops.find((s) => s.seq === 0)?.name ?? null,
      final_stop_name: stops.at(-1)?.name ?? null,
      stop_count: stops.filter((s) => s.stop_type !== 'origin').length,
      cargo_weight_kg: cargo.reduce((a, c) => a + c.weight_kg * c.quantity, 0),
      cargo_volume_m3: cargo.reduce((a, c) => a + c.length_cm * c.width_cm * c.height_cm * c.quantity, 0) / 1e6,
      cargo_units: cargo.reduce((a, c) => a + c.quantity, 0),
      active_plan_id: plan?.id ?? null,
      plan_volume_used_pct: m.volumeUsedPct ?? null,
      plan_weight_used_pct: m.weightUsedPct ?? null,
      route_distance_km: route?.distance_km ?? null,
      route_duration_min: route?.duration_min ?? null,
      route_total_cost_inr: route?.total_cost_inr ?? null,
    }
  })
}

export function fixtureTripFinancials(d: FixtureData = fixtureStore()): Tables<'trip_financials'>[] {
  return d.trips.map((t) => {
    const route = d.route_options.find((r) => r.id === t.selected_route_id)
    const accepted = d.trip_extra_loads.filter((e) => e.trip_id === t.id && e.status === 'accepted')
    const extraRevenue = accepted.reduce(
      (a, e) => a + (d.freight_listings.find((l) => l.id === e.listing_id)?.offered_rate_inr ?? 0),
      0,
    )
    const extraCost = accepted.reduce((a, e) => a + (e.incremental_cost_inr ?? 0), 0)
    const routeCost = route?.total_cost_inr ?? 0
    return {
      trip_id: t.id,
      company_id: t.company_id,
      code: t.code,
      status: t.status,
      planned_departure: t.planned_departure,
      base_freight_inr: t.base_freight_inr,
      extra_revenue_inr: extraRevenue,
      extra_cost_inr: extraCost,
      route_cost_inr: routeCost,
      distance_km: route?.distance_km ?? 0,
      net_earnings_inr: t.base_freight_inr + extraRevenue - routeCost - extraCost,
    }
  })
}

export { buildSeed, FIXTURE_COMPANY_ID, FIXTURE_USER_ID, type FixtureData }
