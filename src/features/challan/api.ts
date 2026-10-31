// Challan corner: trip costs (challans, breakdowns, police, parking, loading) — trip_expenses with RLS for the
// owner; the driver link adds through driver_add_expense (driver feature). They come off the trip's net earnings
// in the trip_financials view. Fixture mode (?fixture=seed, dev only) uses the in-memory store.
import { getSupabase } from '@/lib/supabase'
import { AppError, toAppError } from '@/lib/errors'
import { FIXTURE_COMPANY_ID, fixtureDelay, fixtureStore, isFixtureMode } from '@/lib/fixtures'
import type { Tables } from '@/types/database'
import type { CostKind } from './lib/risks'

export type TripExpense = Tables<'trip_expenses'>

export interface ChallanTrip {
  code: string
  status: string
  cargoKg: number
  payloadKg: number
  warnings: { code: string; city?: string; waitMin?: number; stop?: string }[]
}

export async function listTripExpenses(tripId: string): Promise<TripExpense[]> {
  if (isFixtureMode())
    return fixtureDelay(
      fixtureStore()
        .trip_expenses.filter((e) => e.trip_id === tripId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    )
  const { data, error } = await getSupabase().from('trip_expenses').select('*').eq('trip_id', tripId).order('created_at', { ascending: false })
  if (error) throw toAppError(error)
  return data
}

export async function addTripExpense(tripId: string, kind: CostKind, amountInr: number, note: string): Promise<void> {
  if (!(amountInr >= 0 && amountInr <= 1_000_000)) throw new AppError('BAD_ITEMS')
  const row = { trip_id: tripId, kind, amount_inr: Math.round(amountInr), note: note.trim().slice(0, 200), added_by: 'owner' }
  if (isFixtureMode()) {
    fixtureStore().trip_expenses.push({ ...row, id: crypto.randomUUID(), company_id: FIXTURE_COMPANY_ID, created_at: new Date().toISOString() })
    return fixtureDelay(undefined)
  }
  const { error } = await getSupabase().from('trip_expenses').insert(row)
  if (error) throw toAppError(error)
}

export async function deleteTripExpense(id: string): Promise<void> {
  if (isFixtureMode()) {
    const d = fixtureStore()
    d.trip_expenses = d.trip_expenses.filter((e) => e.id !== id)
    return fixtureDelay(undefined)
  }
  const { error } = await getSupabase().from('trip_expenses').delete().eq('id', id)
  if (error) throw toAppError(error)
}

/** What the risk checks need: cargo weight vs payload, and the chosen route's warnings. */
export async function getChallanTrip(tripId: string): Promise<ChallanTrip> {
  if (isFixtureMode()) {
    const d = fixtureStore()
    const t = d.trips.find((x) => x.id === tripId)
    if (!t) throw new AppError('TRIP_NOT_FOUND')
    const truck = d.trucks.find((x) => x.id === t.truck_id)!
    const route = d.route_options.find((r) => r.id === t.selected_route_id)
    return fixtureDelay({
      code: t.code,
      status: t.status,
      cargoKg: d.cargo_items.filter((c) => c.trip_id === tripId).reduce((a, c) => a + c.quantity * Number(c.weight_kg), 0),
      payloadKg: Number(truck.payload_kg),
      warnings: (route?.warnings as ChallanTrip['warnings'] | undefined) ?? [],
    })
  }
  const sb = getSupabase()
  const { data: t, error } = await sb.from('trips').select('code, status, truck_id, selected_route_id').eq('id', tripId).maybeSingle()
  if (error) throw toAppError(error)
  if (!t) throw new AppError('TRIP_NOT_FOUND')
  const [truck, cargo, route] = await Promise.all([
    sb.from('trucks').select('payload_kg').eq('id', t.truck_id).maybeSingle(),
    sb.from('cargo_items').select('quantity, weight_kg').eq('trip_id', tripId),
    t.selected_route_id ? sb.from('route_options').select('warnings').eq('id', t.selected_route_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ])
  for (const r of [truck, cargo, route]) if (r.error) throw toAppError(r.error)
  return {
    code: t.code,
    status: t.status,
    cargoKg: (cargo.data ?? []).reduce((a, c) => a + c.quantity * Number(c.weight_kg), 0),
    payloadKg: Number(truck.data?.payload_kg ?? 0),
    warnings: ((route.data?.warnings as ChallanTrip['warnings'] | null) ?? []) as ChallanTrip['warnings'],
  }
}
