import { getSupabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import { fixtureDelay, fixtureStore, isFixtureMode } from '@/lib/fixtures'
import type { Tables } from '@/types/database'
import type { GeoLineString } from '@/types/domain'

export type Truck = Tables<'trucks'>

export interface LiveTrip {
  id: string
  code: string
  truckId: string
  status: string
  departure: string | null
  stops: { id: string; seq: number; name: string; lat: number; lng: number; status: string }[]
  /** chosen route if any, else null → straight line through the stops (Approximate) */
  route: { geometry: GeoLineString; durationMin: number; distanceKm: number } | null
}

export interface LiveData {
  trucks: Truck[]
  trips: LiveTrip[]
}

const LIVE = ['in_transit', 'loading']

export async function getLiveData(): Promise<LiveData> {
  if (isFixtureMode()) {
    const d = fixtureStore()
    const trips = d.trips
      .filter((t) => LIVE.includes(t.status))
      .map((t) => {
        const r = d.route_options.find((x) => x.id === t.selected_route_id)
        return {
          id: t.id,
          code: t.code,
          truckId: t.truck_id,
          status: t.status,
          departure: t.actual_departure ?? t.planned_departure,
          stops: d.trip_stops
            .filter((s) => s.trip_id === t.id)
            .sort((a, b) => a.seq - b.seq)
            .map(({ id, seq, name, lat, lng, status }) => ({ id, seq, name, lat, lng, status })),
          route: r ? { geometry: r.geometry as unknown as GeoLineString, durationMin: r.duration_min, distanceKm: r.distance_km } : null,
        }
      })
    return fixtureDelay({
      trucks: d.trucks,
      trips,
    })
  }
  const sb = getSupabase()
  const [trucks, trips] = await Promise.all([
    sb.from('trucks').select('*').order('reg_no'),
    sb.from('trips').select('id, code, truck_id, status, planned_departure, actual_departure, selected_route_id').in('status', LIVE),
  ])
  for (const r of [trucks, trips]) if (r.error) throw toAppError(r.error)
  const tripRows = trips.data ?? []
  const ids = tripRows.map((t) => t.id)
  const routeIds = tripRows.map((t) => t.selected_route_id).filter((x): x is string => Boolean(x))
  const [stops, routes] = await Promise.all([
    ids.length ? sb.from('trip_stops').select('id, trip_id, seq, name, lat, lng, status').in('trip_id', ids).order('seq') : Promise.resolve({ data: [], error: null }),
    routeIds.length
      ? sb.from('route_options').select('id, geometry, duration_min, distance_km').in('id', routeIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (stops.error) throw toAppError(stops.error)
  if (routes.error) throw toAppError(routes.error)
  return {
    trucks: trucks.data ?? [],
    trips: tripRows.map((t) => {
      const r = (routes.data ?? []).find((x) => x.id === t.selected_route_id)
      return {
        id: t.id,
        code: t.code,
        truckId: t.truck_id,
        status: t.status,
        departure: t.actual_departure ?? t.planned_departure,
        stops: (stops.data ?? []).filter((s) => s.trip_id === t.id).map(({ id, seq, name, lat, lng, status }) => ({ id, seq, name, lat, lng, status })),
        route: r ? { geometry: r.geometry as unknown as GeoLineString, durationMin: Number(r.duration_min), distanceKm: Number(r.distance_km) } : null,
      }
    }),
  }
}
