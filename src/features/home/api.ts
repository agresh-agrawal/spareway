import { getSupabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import type { Tables } from '@/types/database'
import { fixtureDashboardStats, fixtureDelay, fixtureStore, isFixtureMode } from '@/lib/fixtures'

export type Alert = Tables<'alerts'>
export type Activity = Tables<'activity_log'>
export type DashboardStats = Tables<'dashboard_stats'>
export type DailyStat = Tables<'fleet_daily_stats'>

export async function fetchDashboardStats(): Promise<DashboardStats | null> {
  if (isFixtureMode()) return fixtureDelay(fixtureDashboardStats())
  const { data, error } = await getSupabase().from('dashboard_stats').select('*').maybeSingle()
  if (error) throw toAppError(error)
  return data
}

export async function fetchOpenAlerts(): Promise<Alert[]> {
  if (isFixtureMode()) return fixtureDelay(fixtureStore().alerts.filter((a) => !a.resolved))
  const { data, error } = await getSupabase()
    .from('alerts')
    .select('*')
    .eq('resolved', false)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw toAppError(error)
  return data
}

export async function resolveAlert(id: string): Promise<void> {
  if (isFixtureMode()) {
    const a = fixtureStore().alerts.find((x) => x.id === id)
    if (a) Object.assign(a, { resolved: true, resolved_at: new Date().toISOString() })
    return fixtureDelay(undefined)
  }
  const { error } = await getSupabase()
    .from('alerts')
    .update({ resolved: true, resolved_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw toAppError(error)
}

export async function fetchRecentActivity(limit = 6): Promise<Activity[]> {
  if (isFixtureMode())
    return fixtureDelay([...fixtureStore().activity_log].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit))
  const { data, error } = await getSupabase()
    .from('activity_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw toAppError(error)
  return data
}

export async function fetchDailyStats(days: number): Promise<DailyStat[]> {
  if (isFixtureMode())
    return fixtureDelay([...fixtureStore().fleet_daily_stats].sort((a, b) => a.day.localeCompare(b.day)).slice(-days))
  const { data, error } = await getSupabase()
    .from('fleet_daily_stats')
    .select('*')
    .order('day', { ascending: false })
    .limit(days)
  if (error) throw toAppError(error)
  return [...data].reverse()
}

/** id → label maps for the truck / trip chips on problem cards */
export async function fetchChipLabels(): Promise<{ trucks: Record<string, string>; trips: Record<string, string> }> {
  if (isFixtureMode()) {
    const d = fixtureStore()
    return fixtureDelay({
      trucks: Object.fromEntries(d.trucks.map((r) => [r.id, r.reg_no])),
      trips: Object.fromEntries(d.trips.map((r) => [r.id, r.code])),
    })
  }
  const sb = getSupabase()
  const [trucks, trips] = await Promise.all([sb.from('trucks').select('id, reg_no'), sb.from('trips').select('id, code')])
  if (trucks.error) throw toAppError(trucks.error)
  if (trips.error) throw toAppError(trips.error)
  return {
    trucks: Object.fromEntries(trucks.data.map((r) => [r.id, r.reg_no])),
    trips: Object.fromEntries(trips.data.map((r) => [r.id, r.code])),
  }
}
