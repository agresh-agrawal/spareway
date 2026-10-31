// Trip history (owner request 3): past trips with their money, from trip_financials + trip_overview (own company
// via RLS). Fixture mode (?fixture=seed, dev only) builds the same rows from the sample store.
import { getSupabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import { fixtureDelay, fixtureStore, fixtureTripFinancials, fixtureTripOverview, isFixtureMode } from '@/lib/fixtures'
import type { HistoryRow } from './lib/history'

export async function listHistory(): Promise<HistoryRow[]> {
  if (isFixtureMode()) {
    const d = fixtureStore()
    const over = fixtureTripOverview(d)
    return fixtureDelay(fixtureTripFinancials(d).map((f) => join(f, over.find((o) => o.id === f.trip_id))))
  }
  const sb = getSupabase()
  const [fin, over] = await Promise.all([
    sb.from('trip_financials').select('*').order('planned_departure', { ascending: false }),
    sb.from('trip_overview').select('id, origin_name, final_stop_name, reg_no, stop_count, cargo_weight_kg'),
  ])
  if (fin.error) throw toAppError(fin.error)
  if (over.error) throw toAppError(over.error)
  return (fin.data ?? []).map((f) => join(f, over.data?.find((o) => o.id === f.trip_id)))
}

type Fin = ReturnType<typeof fixtureTripFinancials>[number]
type Over = { origin_name: string | null; final_stop_name: string | null; reg_no: string | null; stop_count: number | null; cargo_weight_kg: number | null }

function join(f: Fin, o: Over | undefined): HistoryRow {
  return {
    tripId: f.trip_id ?? '',
    code: f.code ?? '',
    status: f.status ?? '',
    departure: f.planned_departure,
    completedAt: f.completed_at,
    from: o?.origin_name ?? '',
    to: o?.final_stop_name ?? '',
    regNo: o?.reg_no ?? '',
    driver: f.driver_name ?? '',
    stops: Math.max(0, (o?.stop_count ?? 1) - 1),
    cargoKg: Number(o?.cargo_weight_kg ?? 0),
    km: Number(f.distance_km ?? 0),
    freightInr: Number(f.base_freight_inr ?? 0),
    extraInr: Number(f.extra_revenue_inr ?? 0),
    routeCostInr: Number(f.route_cost_inr ?? 0),
    extraCostInr: Number(f.extra_cost_inr ?? 0),
    miscInr: Number(f.misc_cost_inr ?? 0),
    challanInr: Number(f.challan_cost_inr ?? 0),
    netInr: Number(f.net_earnings_inr ?? 0),
  }
}
