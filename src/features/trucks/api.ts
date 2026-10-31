import { getSupabase } from '@/lib/supabase'
import { AppError, toAppError } from '@/lib/errors'
import { fixtureDelay, fixtureStore, fixtureTripOverview, FIXTURE_COMPANY_ID, isFixtureMode } from '@/lib/fixtures'
import type { Tables } from '@/types/database'
import type { TruckValues } from './schemas'

export type Truck = Tables<'trucks'>
export type TripOverview = Tables<'trip_overview'>

const OPEN_TRIP = ['planned', 'loading', 'in_transit']

export async function listTrucks(): Promise<Truck[]> {
  if (isFixtureMode()) return fixtureDelay([...fixtureStore().trucks].sort((a, b) => a.reg_no.localeCompare(b.reg_no)))
  const { data, error } = await getSupabase().from('trucks').select('*').order('reg_no')
  if (error) throw toAppError(error)
  return data
}

export async function getTruck(id: string): Promise<Truck> {
  if (isFixtureMode()) {
    const t = fixtureStore().trucks.find((x) => x.id === id)
    if (!t) throw new AppError('TRIP_NOT_FOUND')
    return fixtureDelay(t)
  }
  const { data, error } = await getSupabase().from('trucks').select('*').eq('id', id).maybeSingle()
  if (error) throw toAppError(error)
  if (!data) throw new AppError('TRIP_NOT_FOUND')
  return data
}

/** Open trip (planned / loading / on the road) per truck id → trip code + id */
export async function listOpenTripsByTruck(): Promise<Record<string, { id: string; code: string }>> {
  const rows = isFixtureMode()
    ? fixtureTripOverview().filter((t) => OPEN_TRIP.includes(t.status ?? ''))
    : await (async () => {
        const { data, error } = await getSupabase()
          .from('trip_overview')
          .select('id, code, truck_id, status, planned_departure')
          .in('status', OPEN_TRIP)
          .order('planned_departure', { ascending: true })
        if (error) throw toAppError(error)
        return data
      })()
  const out: Record<string, { id: string; code: string }> = {}
  for (const r of rows) if (r.truck_id && r.id && r.code && !out[r.truck_id]) out[r.truck_id] = { id: r.id, code: r.code }
  return isFixtureMode() ? fixtureDelay(out) : out
}

export async function listTruckTrips(truckId: string): Promise<TripOverview[]> {
  if (isFixtureMode())
    return fixtureDelay(
      fixtureTripOverview()
        .filter((t) => t.truck_id === truckId)
        .sort((a, b) => (b.planned_departure ?? '').localeCompare(a.planned_departure ?? '')),
    )
  const { data, error } = await getSupabase()
    .from('trip_overview')
    .select('*')
    .eq('truck_id', truckId)
    .order('planned_departure', { ascending: false })
  if (error) throw toAppError(error)
  return data
}


/** Create (no id) or update a truck. A duplicate number → AppError('DUPLICATE'). */
export async function saveTruck(v: TruckValues, id?: string): Promise<Truck> {
  if (isFixtureMode()) {
    const d = fixtureStore()
    if (d.trucks.some((t) => t.reg_no === v.reg_no && t.id !== id)) throw new AppError('DUPLICATE')
    if (id) {
      const t = d.trucks.find((x) => x.id === id)!
      Object.assign(t, v, { updated_at: new Date().toISOString() })
      return fixtureDelay(t)
    }
    const now = new Date().toISOString()
    const t: Truck = {
      ...v,
      id: crypto.randomUUID(),
      company_id: FIXTURE_COMPANY_ID,
      gross_weight_kg: null,
      door_position: 'rear',
      fuel_type: 'diesel',
      home_city: '',
      last_lat: null,
      last_lng: null,
      fuel_level_pct: null,
      is_sample: false,
      created_at: now,
      updated_at: now,
    }
    d.trucks.push(t)
    return fixtureDelay(t)
  }
  const sb = getSupabase()
  const q = id ? sb.from('trucks').update(v).eq('id', id).select().single() : sb.from('trucks').insert(v).select().single()
  const { data, error } = await q
  if (error) throw toAppError(error)
  return data
}

/** Status change + activity row (kind truck_status, meta {reg, status}). */
export async function setTruckStatus(truck: Truck, status: string): Promise<void> {
  const message = `${truck.reg_no} is now ${status}`
  if (isFixtureMode()) {
    const d = fixtureStore()
    const t = d.trucks.find((x) => x.id === truck.id)
    if (t) t.status = status
    d.activity_log.push({
      id: crypto.randomUUID(),
      company_id: FIXTURE_COMPANY_ID,
      kind: 'truck_status',
      message,
      entity_type: 'truck',
      entity_ref: truck.reg_no,
      meta: { reg: truck.reg_no, status },
      is_sample: false,
      created_at: new Date().toISOString(),
    })
    return fixtureDelay(undefined)
  }
  const sb = getSupabase()
  const { error } = await sb.from('trucks').update({ status }).eq('id', truck.id)
  if (error) throw toAppError(error)
  const { error: aErr } = await sb.from('activity_log').insert({
    kind: 'truck_status',
    message,
    entity_type: 'truck',
    entity_ref: truck.reg_no,
    meta: { reg: truck.reg_no, status },
  })
  if (aErr) throw toAppError(aErr)
}

/** Only trucks without trips can be deleted (trips keep a hard link to their truck). */
export async function deleteTruck(id: string): Promise<'deleted' | 'has_trips'> {
  if (isFixtureMode()) {
    const d = fixtureStore()
    if (d.trips.some((t) => t.truck_id === id)) return fixtureDelay('has_trips' as const)
    d.trucks = d.trucks.filter((t) => t.id !== id)
    return fixtureDelay('deleted' as const)
  }
  const sb = getSupabase()
  const { count, error: cErr } = await sb.from('trips').select('id', { count: 'exact', head: true }).eq('truck_id', id)
  if (cErr) throw toAppError(cErr)
  if ((count ?? 0) > 0) return 'has_trips'
  const { error } = await sb.from('trucks').delete().eq('id', id)
  if (error) throw toAppError(error)
  return 'deleted'
}
