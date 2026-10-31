// Driver link (Pre-Phase 4): owner creates / turns off the link; the driver page reads driver_get_trip (no login).
// Fixture mode (?fixture=seed, dev only) builds the same answer from the sample store.
import { getSupabase } from '@/lib/supabase'
import { AppError, throwIfDataError, toAppError } from '@/lib/errors'
import { fixtureDelay, fixtureStore, isFixtureMode } from '@/lib/fixtures'
import type { GeoLineString, Halt } from '@/types/domain'

export interface DriverStop {
  id: string
  seq: number
  type: 'origin' | 'pickup' | 'drop'
  name: string
  city: string
  lat: number
  lng: number
  eta: string | null
  windowEnd: string | null
  status: 'pending' | 'arrived' | 'done'
}

export interface DriverTrip {
  trip: { code: string; status: string; departure: string | null }
  company: { name: string; phone: string }
  truck: { regNo: string; model: string; driverName: string; payloadKg: number }
  cargoKg: number
  expenses: { kind: string; amount: number; note: string; at: string }[]
  stops: DriverStop[]
  drops: { stopId: string; lines: number; pieces: number; kg: number; fragile: boolean }[]
  route: null | {
    variant: string
    distanceKm: number
    durationMin: number
    tollCount: number
    geometry: GeoLineString
    halts: Halt[]
    warnings: { code: string; message: string }[]
  }
}

export interface DriverLinkState {
  token: string | null
  enabled: boolean
}

export async function getDriverLinkState(tripId: string): Promise<DriverLinkState> {
  if (isFixtureMode()) {
    const t = fixtureStore().trips.find((x) => x.id === tripId)
    if (!t) throw new AppError('TRIP_NOT_FOUND')
    return fixtureDelay({ token: t.driver_token, enabled: t.driver_link_enabled })
  }
  const { data, error } = await getSupabase().from('trips').select('driver_token, driver_link_enabled').eq('id', tripId).maybeSingle()
  if (error) throw toAppError(error)
  if (!data) throw new AppError('TRIP_NOT_FOUND')
  return { token: data.driver_token, enabled: data.driver_link_enabled }
}

export async function createDriverLink(tripId: string): Promise<string> {
  if (isFixtureMode()) {
    const t = fixtureStore().trips.find((x) => x.id === tripId)!
    t.driver_token = crypto.randomUUID().replace(/-/g, '')
    t.driver_link_enabled = true
    return fixtureDelay(t.driver_token)
  }
  const { data, error } = await getSupabase().rpc('create_driver_link', { p_trip_id: tripId })
  if (error) throw toAppError(error)
  return (data as { token: string }).token
}

export async function disableDriverLink(tripId: string): Promise<void> {
  if (isFixtureMode()) {
    const t = fixtureStore().trips.find((x) => x.id === tripId)
    if (t) t.driver_link_enabled = false
    return fixtureDelay(undefined)
  }
  const { error } = await getSupabase().rpc('disable_driver_link', { p_trip_id: tripId })
  if (error) throw toAppError(error)
}

function fixtureTrip(token: string): DriverTrip {
  const d = fixtureStore()
  const t = d.trips.find((x) => x.driver_token === token && x.driver_link_enabled && x.status !== 'cancelled')
  if (!t) throw new AppError('LINK_INVALID')
  const truck = d.trucks.find((x) => x.id === t.truck_id)!
  const route = d.route_options.find((r) => r.id === t.selected_route_id)
  const stops = d.trip_stops.filter((s) => s.trip_id === t.id).sort((a, b) => a.seq - b.seq)
  const cargo = d.cargo_items.filter((c) => c.trip_id === t.id)
  return {
    trip: { code: t.code, status: t.status, departure: t.actual_departure ?? t.planned_departure },
    company: { name: d.company.name, phone: d.company.phone },
    truck: { regNo: truck.reg_no, model: truck.model, driverName: t.driver_name || truck.driver_name, payloadKg: Number(truck.payload_kg) },
    cargoKg: Math.round(cargo.reduce((n, c) => n + c.quantity * Number(c.weight_kg), 0)),
    expenses: d.trip_expenses
      .filter((e) => e.trip_id === t.id && e.added_by === 'driver')
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((e) => ({ kind: e.kind, amount: e.amount_inr, note: e.note, at: e.created_at })),
    stops: stops.map((s) => ({
      id: s.id,
      seq: s.seq,
      type: s.stop_type as DriverStop['type'],
      name: s.name,
      city: s.city,
      lat: s.lat,
      lng: s.lng,
      eta: s.eta,
      windowEnd: s.window_end,
      status: s.status as DriverStop['status'],
    })),
    drops: [...new Set(cargo.map((c) => c.drop_stop_id))].map((stopId) => {
      const lines = cargo.filter((c) => c.drop_stop_id === stopId)
      return {
        stopId,
        lines: lines.length,
        pieces: lines.reduce((n, c) => n + c.quantity, 0),
        kg: Math.round(lines.reduce((n, c) => n + c.quantity * Number(c.weight_kg), 0)),
        fragile: lines.some((c) => c.fragile),
      }
    }),
    route: route
      ? {
          variant: route.variant,
          distanceKm: Number(route.distance_km),
          durationMin: Number(route.duration_min),
          tollCount: route.toll_count,
          geometry: route.geometry as unknown as GeoLineString,
          halts: route.halts as unknown as Halt[],
          warnings: route.warnings as unknown as { code: string; message: string }[],
        }
      : null,
  }
}

export async function getDriverTrip(token: string): Promise<DriverTrip> {
  if (isFixtureMode()) return fixtureDelay(fixtureTrip(token))
  const { data, error } = await getSupabase().rpc('driver_get_trip', { p_token: token })
  if (error) throw toAppError(error)
  return throwIfDataError(data) as unknown as DriverTrip
}

function fixtureTripFor(token: string) {
  const t = fixtureStore().trips.find((x) => x.driver_token === token && x.driver_link_enabled && x.status !== 'cancelled')
  if (!t) throw new AppError('LINK_INVALID')
  return t
}

/** Driver taps "I reached" / "Delivered" on a stop (driver_mark_stop) — the owner gets a notification. */
export async function markDriverStop(token: string, stopId: string, status: 'arrived' | 'done'): Promise<void> {
  if (isFixtureMode()) {
    const t = fixtureTripFor(token)
    const s = fixtureStore().trip_stops.find((x) => x.id === stopId && x.trip_id === t.id && x.stop_type !== 'origin')
    if (!s) throw new AppError('BAD_ITEMS')
    s.status = status
    return fixtureDelay(undefined)
  }
  const { data, error } = await getSupabase().rpc('driver_mark_stop', { p_token: token, p_stop_id: stopId, p_status: status })
  if (error) throw toAppError(error)
  throwIfDataError(data)
}

/** Driver reports a challan or another cost (driver_add_expense) — counted in the trip's earnings, owner notified. */
export async function addDriverExpense(token: string, kind: string, amountInr: number, note: string): Promise<void> {
  if (isFixtureMode()) {
    const t = fixtureTripFor(token)
    fixtureStore().trip_expenses.push({
      id: crypto.randomUUID(),
      company_id: t.company_id,
      trip_id: t.id,
      kind,
      amount_inr: Math.round(amountInr),
      note: note.trim().slice(0, 200),
      added_by: 'driver',
      created_at: new Date().toISOString(),
    })
    return fixtureDelay(undefined)
  }
  const { data, error } = await getSupabase().rpc('driver_add_expense', { p_token: token, p_kind: kind, p_amount: amountInr, p_note: note })
  if (error) throw toAppError(error)
  throwIfDataError(data)
}
