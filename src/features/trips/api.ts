import { getSupabase } from '@/lib/supabase'
import { AppError, throwIfDataError, toAppError } from '@/lib/errors'
import { fixtureDelay, fixtureStore, fixtureTripOverview, FIXTURE_COMPANY_ID, isFixtureMode } from '@/lib/fixtures'
import type { Tables } from '@/types/database'
import type { WizardStop } from './schemas'

export type TripOverview = Tables<'trip_overview'>
export type Trip = Tables<'trips'>
export type TripStop = Tables<'trip_stops'>

export async function listTrips(): Promise<TripOverview[]> {
  if (isFixtureMode())
    return fixtureDelay(fixtureTripOverview().sort((a, b) => (b.planned_departure ?? '').localeCompare(a.planned_departure ?? '')))
  const { data, error } = await getSupabase().from('trip_overview').select('*').order('planned_departure', { ascending: false })
  if (error) throw toAppError(error)
  return data
}

export interface TripBundle {
  trip: Trip
  overview: TripOverview
}

export async function getTrip(id: string): Promise<TripBundle> {
  if (isFixtureMode()) {
    const trip = fixtureStore().trips.find((x) => x.id === id)
    const overview = fixtureTripOverview().find((x) => x.id === id)
    if (!trip || !overview) throw new AppError('TRIP_NOT_FOUND')
    return fixtureDelay({ trip, overview })
  }
  const sb = getSupabase()
  const [t, o] = await Promise.all([
    sb.from('trips').select('*').eq('id', id).maybeSingle(),
    sb.from('trip_overview').select('*').eq('id', id).maybeSingle(),
  ])
  if (t.error) throw toAppError(t.error)
  if (o.error) throw toAppError(o.error)
  if (!t.data || !o.data) throw new AppError('TRIP_NOT_FOUND')
  return { trip: t.data, overview: o.data }
}

export async function getTripStops(tripId: string): Promise<TripStop[]> {
  if (isFixtureMode()) return fixtureDelay(fixtureStore().trip_stops.filter((s) => s.trip_id === tripId).sort((a, b) => a.seq - b.seq))
  const { data, error } = await getSupabase().from('trip_stops').select('*').eq('trip_id', tripId).order('seq')
  if (error) throw toAppError(error)
  return data
}

export interface NewTrip {
  truckId: string
  departure: string // ISO
  freight: number
  stops: WizardStop[]
  driverName: string
  driverPhone: string
}

function toStopJson(s: WizardStop) {
  return {
    stop_type: s.stop_type,
    name: s.name,
    city: s.city,
    lat: s.lat,
    lng: s.lng,
    window_end: s.deliverBy ? new Date(s.deliverBy).toISOString() : '',
  }
}

/** Trip + stops + activity in one transaction (create_trip_with_stops, phase1code_trips.sql). */
export async function createTrip(input: NewTrip): Promise<{ id: string; code: string }> {
  if (isFixtureMode()) {
    const d = fixtureStore()
    const max = Math.max(0, ...d.trips.map((t) => Number(t.code.split('-')[2]) || 0))
    const code = `TRP-${new Date().getFullYear()}-${String(max + 1).padStart(4, '0')}`
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    d.trips.push({
      id,
      company_id: FIXTURE_COMPANY_ID,
      code,
      truck_id: input.truckId,
      status: 'planned',
      planned_departure: input.departure,
      actual_departure: null,
      completed_at: null,
      base_freight_inr: input.freight,
      selected_route_id: null,
      notes: '',
      loader_token: null,
      loader_token_expires_at: null,
      loader_link_enabled: false,
      driver_token: null,
      driver_link_enabled: false,
      gps_lat: null,
      gps_lng: null,
      gps_accuracy_m: null,
      gps_speed_kmph: null,
      gps_at: null,
      driver_name: input.driverName,
      driver_phone: input.driverPhone,
      is_sample: false,
      created_at: now,
      updated_at: now,
    })
    if (input.driverName) Object.assign(d.trucks.find((x) => x.id === input.truckId)!, { driver_name: input.driverName, driver_phone: input.driverPhone })
    input.stops.forEach((s, seq) => {
      const j = toStopJson(s)
      d.trip_stops.push({
        id: crypto.randomUUID(),
        company_id: FIXTURE_COMPANY_ID,
        trip_id: id,
        seq,
        stop_type: j.stop_type,
        name: j.name,
        city: j.city,
        lat: j.lat,
        lng: j.lng,
        window_start: null,
        window_end: j.window_end || null,
        eta: null,
        status: 'pending',
        created_at: now,
      })
    })
    d.activity_log.push({
      id: crypto.randomUUID(),
      company_id: FIXTURE_COMPANY_ID,
      kind: 'trip_created',
      message: `New trip ${code}`,
      entity_type: 'trip',
      entity_ref: code,
      meta: { code },
      is_sample: false,
      created_at: now,
    })
    return fixtureDelay({ id, code })
  }
  const { data, error } = await getSupabase().rpc('create_trip_with_stops', {
    p_truck_id: input.truckId,
    p_planned_departure: input.departure,
    p_base_freight_inr: input.freight,
    p_stops: input.stops.map(toStopJson),
    p_driver_name: input.driverName,
    p_driver_phone: input.driverPhone,
  })
  if (error) throw toAppError(error)
  return throwIfDataError(data) as { id: string; code: string }
}

/** Big status button: Start loading → Leave (ends the loader link) → Mark delivered. */
export async function advanceTrip(trip: Trip): Promise<void> {
  const now = new Date().toISOString()
  let patch: Partial<Trip>
  if (trip.status === 'planned') patch = { status: 'loading' }
  else if (trip.status === 'loading') patch = { status: 'in_transit', actual_departure: now, loader_link_enabled: false }
  else if (trip.status === 'in_transit') patch = { status: 'completed', completed_at: now }
  else return
  if (isFixtureMode()) {
    const d = fixtureStore()
    Object.assign(d.trips.find((x) => x.id === trip.id)!, patch, { updated_at: now })
    if (patch.status === 'completed') for (const s of d.trip_stops.filter((x) => x.trip_id === trip.id)) s.status = 'done'
    return fixtureDelay(undefined)
  }
  const sb = getSupabase()
  const { error } = await sb.from('trips').update(patch).eq('id', trip.id)
  if (error) throw toAppError(error)
  if (patch.status === 'completed') {
    const { error: sErr } = await sb.from('trip_stops').update({ status: 'done' }).eq('trip_id', trip.id)
    if (sErr) throw toAppError(sErr)
  }
}
