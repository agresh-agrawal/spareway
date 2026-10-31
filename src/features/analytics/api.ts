// The only place in analytics that talks to Supabase. Reads trip_financials (view), the trip with its truck,
// stops, cargo and chosen route distance, fleet_daily_stats and completed trips (own company via RLS).
// Fixture mode (?fixture=seed, dev only) uses the in-memory seed and the view computed like SQL.
import { getSupabase } from '@/lib/supabase'
import { AppError, toAppError } from '@/lib/errors'
import { fixtureDelay, fixtureStore, fixtureTripFinancials, isFixtureMode } from '@/lib/fixtures'
import type { Tables } from '@/types/database'

export type FinancialsRow = Tables<'trip_financials'>
export type DailyStatRow = Tables<'fleet_daily_stats'>

export interface TripEarningsData {
  financials: FinancialsRow
  trip: Tables<'trips'>
  truck: Tables<'trucks'>
  stops: Tables<'trip_stops'>[]
  cargo: Tables<'cargo_items'>[]
  /** chosen route km (null = no route chosen) */
  routeKm: number | null
}

export async function fetchTripEarnings(tripId: string): Promise<TripEarningsData> {
  if (isFixtureMode()) {
    const d = fixtureStore()
    const trip = d.trips.find((t) => t.id === tripId)
    const truck = trip && d.trucks.find((t) => t.id === trip.truck_id)
    const financials = fixtureTripFinancials(d).find((f) => f.trip_id === tripId)
    if (!trip || !truck || !financials) throw new AppError('TRIP_NOT_FOUND')
    const route = d.route_options.find((r) => r.id === trip.selected_route_id)
    return fixtureDelay({
      financials,
      trip,
      truck,
      stops: d.trip_stops.filter((s) => s.trip_id === tripId).sort((a, b) => a.seq - b.seq),
      cargo: d.cargo_items.filter((c) => c.trip_id === tripId),
      routeKm: route ? Number(route.distance_km) : null,
    })
  }
  const sb = getSupabase()
  const { data: trip, error } = await sb.from('trips').select('*').eq('id', tripId).maybeSingle()
  if (error) throw toAppError(error)
  if (!trip) throw new AppError('TRIP_NOT_FOUND')
  const [fin, truck, stops, cargo, route] = await Promise.all([
    sb.from('trip_financials').select('*').eq('trip_id', tripId).maybeSingle(),
    sb.from('trucks').select('*').eq('id', trip.truck_id).maybeSingle(),
    sb.from('trip_stops').select('*').eq('trip_id', tripId).order('seq'),
    sb.from('cargo_items').select('*').eq('trip_id', tripId),
    trip.selected_route_id
      ? sb.from('route_options').select('distance_km').eq('id', trip.selected_route_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])
  for (const r of [fin, truck, stops, cargo, route]) if (r.error) throw toAppError(r.error)
  if (!fin.data || !truck.data) throw new AppError('TRIP_NOT_FOUND')
  return {
    financials: fin.data,
    trip,
    truck: truck.data,
    stops: stops.data ?? [],
    cargo: cargo.data ?? [],
    routeKm: route.data ? Number(route.data.distance_km) : null,
  }
}

/** The last `days` days of fleet stats, oldest first. */
export async function fetchFleetStats(days: number): Promise<DailyStatRow[]> {
  if (isFixtureMode()) return fixtureDelay([...fixtureStore().fleet_daily_stats].sort((a, b) => a.day.localeCompare(b.day)).slice(-days))
  const { data, error } = await getSupabase().from('fleet_daily_stats').select('*').order('day', { ascending: false }).limit(days)
  if (error) throw toAppError(error)
  return [...data].reverse()
}

/** Every trip's money (view trip_financials), best first. */
export async function fetchTripFinancials(): Promise<FinancialsRow[]> {
  if (isFixtureMode()) return fixtureDelay([...fixtureTripFinancials()].sort((a, b) => Number(b.net_earnings_inr) - Number(a.net_earnings_inr)))
  const { data, error } = await getSupabase().from('trip_financials').select('*').order('net_earnings_inr', { ascending: false }).limit(50)
  if (error) throw toAppError(error)
  return data
}

/** Trips completed in the last `days` days. */
export async function fetchTripsDone(days: number, now: Date = new Date()): Promise<number> {
  const since = new Date(now.getTime() - days * 86_400_000).toISOString()
  if (isFixtureMode()) return fixtureDelay(fixtureStore().trips.filter((t) => t.status === 'completed' && (t.completed_at ?? '') >= since).length)
  const { count, error } = await getSupabase().from('trips').select('id', { count: 'exact', head: true }).eq('status', 'completed').gte('completed_at', since)
  if (error) throw toAppError(error)
  return count ?? 0
}
