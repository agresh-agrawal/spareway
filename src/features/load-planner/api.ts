// The only place in load-planner that talks to Supabase. Reads trips, trucks, stops, cargo, settings,
// load_plans and loading_progress (own company via RLS); writes load_plans, alerts and calls activate_load_plan.
// Fixture mode (?fixture=seed, dev only) uses the in-memory seed and copies what the SQL does.
import { getSupabase } from '@/lib/supabase'
import { toAppError, AppError } from '@/lib/errors'
import { fixtureDelay, fixtureStore, isFixtureMode } from '@/lib/fixtures'
import type { Json, Tables } from '@/types/database'
import type { PackResult } from '@/types/domain'

export type TripRow = Tables<'trips'>
export type TruckRow = Tables<'trucks'>
export type StopRow = Tables<'trip_stops'>
export type CargoRow = Tables<'cargo_items'>
export type PlanRow = Tables<'load_plans'>
export type ProgressRow = Tables<'loading_progress'>

export interface TripBasics {
  trip: TripRow
  truck: TruckRow
  supportRatio: number
}

const DEFAULT_SUPPORT_RATIO = 1

export async function fetchTripBasics(tripId: string): Promise<TripBasics> {
  if (isFixtureMode()) {
    const d = fixtureStore()
    const trip = d.trips.find((t) => t.id === tripId)
    if (!trip) throw new AppError('TRIP_NOT_FOUND')
    const truck = d.trucks.find((t) => t.id === trip.truck_id)
    if (!truck) throw new AppError('TRIP_NOT_FOUND')
    return fixtureDelay({ trip, truck, supportRatio: d.settings.support_ratio ?? DEFAULT_SUPPORT_RATIO })
  }
  const sb = getSupabase()
  const { data: trip, error } = await sb.from('trips').select('*').eq('id', tripId).maybeSingle()
  if (error) throw toAppError(error)
  if (!trip) throw new AppError('TRIP_NOT_FOUND')
  const [truck, settings] = await Promise.all([
    sb.from('trucks').select('*').eq('id', trip.truck_id).maybeSingle(),
    sb.from('company_settings').select('support_ratio').maybeSingle(),
  ])
  if (truck.error) throw toAppError(truck.error)
  if (!truck.data) throw new AppError('TRIP_NOT_FOUND')
  if (settings.error) throw toAppError(settings.error)
  return { trip, truck: truck.data, supportRatio: Number(settings.data?.support_ratio ?? DEFAULT_SUPPORT_RATIO) }
}

export async function fetchStops(tripId: string): Promise<StopRow[]> {
  if (isFixtureMode())
    return fixtureDelay(fixtureStore().trip_stops.filter((s) => s.trip_id === tripId).sort((a, b) => a.seq - b.seq))
  const { data, error } = await getSupabase().from('trip_stops').select('*').eq('trip_id', tripId).order('seq')
  if (error) throw toAppError(error)
  return data
}

export async function fetchCargo(tripId: string): Promise<CargoRow[]> {
  if (isFixtureMode())
    return fixtureDelay(
      fixtureStore()
        .cargo_items.filter((c) => c.trip_id === tripId)
        .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)),
    )
  const { data, error } = await getSupabase()
    .from('cargo_items')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at')
    .order('id')
  if (error) throw toAppError(error)
  return data
}

/** Saved plans of a trip, newest version first. */
export async function fetchPlans(tripId: string): Promise<PlanRow[]> {
  if (isFixtureMode())
    return fixtureDelay(fixtureStore().load_plans.filter((p) => p.trip_id === tripId).sort((a, b) => b.version - a.version))
  const { data, error } = await getSupabase()
    .from('load_plans')
    .select('*')
    .eq('trip_id', tripId)
    .order('version', { ascending: false })
  if (error) throw toAppError(error)
  return data
}

export async function fetchProgress(planId: string): Promise<ProgressRow[]> {
  if (isFixtureMode())
    return fixtureDelay(
      fixtureStore()
        .loading_progress.filter((p) => p.load_plan_id === planId)
        .sort((a, b) => a.step_index - b.step_index),
    )
  const { data, error } = await getSupabase()
    .from('loading_progress')
    .select('*')
    .eq('load_plan_id', planId)
    .order('step_index')
  if (error) throw toAppError(error)
  return data
}

/** Trips that can be planned (planned / loading), soonest departure first — for "Plan load" and the truck tab. */
export async function fetchPlannableTrips(truckId?: string): Promise<{ trip: TripRow; activePlanId: string | null }[]> {
  if (isFixtureMode()) {
    const d = fixtureStore()
    const trips = d.trips
      .filter((t) => (t.status === 'planned' || t.status === 'loading') && (!truckId || t.truck_id === truckId))
      .sort((a, b) => (a.planned_departure ?? '').localeCompare(b.planned_departure ?? ''))
    return fixtureDelay(
      trips.map((trip) => ({
        trip,
        activePlanId: d.load_plans.find((p) => p.trip_id === trip.id && p.status === 'active')?.id ?? null,
      })),
    )
  }
  const sb = getSupabase()
  let q = sb.from('trips').select('*').in('status', ['planned', 'loading'])
  if (truckId) q = q.eq('truck_id', truckId)
  const { data: trips, error } = await q.order('planned_departure', { ascending: true, nullsFirst: false })
  if (error) throw toAppError(error)
  if (trips.length === 0) return []
  const { data: plans, error: pErr } = await sb
    .from('load_plans')
    .select('id, trip_id')
    .eq('status', 'active')
    .in(
      'trip_id',
      trips.map((t) => t.id),
    )
  if (pErr) throw toAppError(pErr)
  return trips.map((trip) => ({ trip, activePlanId: plans.find((p) => p.trip_id === trip.id)?.id ?? null }))
}

/** The truck's current trip (loading / on the road) or else its next planned trip, with its active plan and stops. */
export async function fetchTruckLayout(
  truckId: string,
): Promise<{ trip: TripRow; truck: TruckRow; plan: PlanRow | null; stops: StopRow[] } | null> {
  const rank: Record<string, number> = { loading: 0, in_transit: 1, planned: 2 }
  const pick = (trips: TripRow[]) =>
    trips
      .filter((t) => t.status in rank)
      .sort(
        (a, b) => rank[a.status] - rank[b.status] || (a.planned_departure ?? '').localeCompare(b.planned_departure ?? ''),
      )[0]
  if (isFixtureMode()) {
    const d = fixtureStore()
    const truck = d.trucks.find((t) => t.id === truckId)
    const trip = pick(d.trips.filter((t) => t.truck_id === truckId))
    if (!trip || !truck) return fixtureDelay(null)
    const plan = d.load_plans.find((p) => p.trip_id === trip.id && p.status === 'active') ?? null
    const stops = d.trip_stops.filter((s) => s.trip_id === trip.id).sort((a, b) => a.seq - b.seq)
    return fixtureDelay({ trip, truck, plan, stops })
  }
  const sb = getSupabase()
  const { data: trips, error } = await sb
    .from('trips')
    .select('*')
    .eq('truck_id', truckId)
    .in('status', ['planned', 'loading', 'in_transit'])
  if (error) throw toAppError(error)
  const trip = pick(trips)
  if (!trip) return null
  const [truck, plan, stops] = await Promise.all([
    sb.from('trucks').select('*').eq('id', truckId).maybeSingle(),
    sb.from('load_plans').select('*').eq('trip_id', trip.id).eq('status', 'active').maybeSingle(),
    sb.from('trip_stops').select('*').eq('trip_id', trip.id).order('seq'),
  ])
  if (truck.error) throw toAppError(truck.error)
  if (plan.error) throw toAppError(plan.error)
  if (stops.error) throw toAppError(stops.error)
  if (!truck.data) return null
  return { trip, truck: truck.data, plan: plan.data, stops: stops.data }
}

/** Save a packed plan as the trip's next version (draft). Items that didn't fit are listed on the plan itself. */
export async function savePlan(trip: Pick<TripRow, 'id' | 'code' | 'truck_id'>, result: PackResult): Promise<PlanRow> {
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
    const saved: PlanRow = {
      ...row,
      id: crypto.randomUUID(),
      company_id: d.company.id,
      version,
      created_by: d.profile.id,
      created_at: now,
    }
    d.load_plans.push(saved)
    return fixtureDelay(saved)
  }

  const sb = getSupabase()
  const { data: last, error: vErr } = await sb
    .from('load_plans')
    .select('version')
    .eq('trip_id', trip.id)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (vErr) throw toAppError(vErr)
  const { data: user } = await sb.auth.getUser()
  const { data, error } = await sb
    .from('load_plans')
    .insert({ ...row, version: (last?.version ?? 0) + 1, created_by: user.user?.id ?? null })
    .select('*')
    .single()
  if (error) throw toAppError(error)
  return data
}

/** activate_load_plan: this plan active, older ones superseded, loading steps created, activity written. */
export async function activatePlan(planId: string): Promise<void> {
  if (isFixtureMode()) {
    const d = fixtureStore()
    const plan = d.load_plans.find((p) => p.id === planId)
    if (!plan) throw new AppError('PLAN_NOT_FOUND')
    for (const p of d.load_plans) if (p.trip_id === plan.trip_id && p.id !== planId && p.status === 'active') p.status = 'superseded'
    plan.status = 'active'
    const now = new Date().toISOString()
    d.loading_progress = d.loading_progress.filter((r) => r.load_plan_id !== planId)
    for (const el of plan.placements as unknown as { step: number; key: string }[])
      d.loading_progress.push({
        id: crypto.randomUUID(),
        company_id: d.company.id,
        load_plan_id: planId,
        step_index: el.step,
        placement_key: el.key,
        status: 'pending',
        note: '',
        updated_at: now,
      })
    const trip = d.trips.find((t) => t.id === plan.trip_id)
    const vol = String((plan.metrics as { volumeUsedPct?: number }).volumeUsedPct ?? '?')
    d.activity_log.push({
      id: crypto.randomUUID(),
      company_id: d.company.id,
      kind: 'plan_activated',
      message: `Load plan v${plan.version} activated (${vol}% space used)`,
      entity_type: 'trip',
      entity_ref: trip?.code ?? '',
      meta: { plan_id: plan.id, version: plan.version, volumeUsedPct: vol },
      is_sample: false,
      created_at: now,
    })
    return fixtureDelay(undefined)
  }
  const { error } = await getSupabase().rpc('activate_load_plan', { p_plan_id: planId })
  if (error) throw toAppError(error)
}
