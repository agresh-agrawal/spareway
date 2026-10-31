import { useQuery } from '@tanstack/react-query'
import { getSupabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import { queryKeys } from '@/lib/queryKeys'
import { useRealtime } from '@/lib/realtime'
import { fixtureDelay, fixtureStore, isFixtureMode } from '@/lib/fixtures'

/** Open problems count for the bell (realtime). */
export function useOpenAlertCount(enabled = true) {
  useRealtime('alerts', [queryKeys.alertsAll], undefined, enabled)
  return useQuery({
    queryKey: [...queryKeys.alerts(true), 'count'],
    enabled,
    queryFn: async () => {
      if (isFixtureMode()) return fixtureDelay(fixtureStore().alerts.filter((a) => !a.resolved).length)
      const { count, error } = await getSupabase()
        .from('alerts')
        .select('id', { count: 'exact', head: true })
        .eq('resolved', false)
      if (error) throw toAppError(error)
      return count ?? 0
    },
  })
}

export interface SearchResult {
  trucks: { id: string; reg_no: string; status: string }[]
  trips: { id: string; code: string; status: string }[]
}

/** Trucks by number, trips by code. Spaces are ignored ("mp09hg" finds "MP09 HG 4821"). */
export function useShellSearch(q: string) {
  const term = q.trim()
  return useQuery({
    queryKey: queryKeys.search(term),
    enabled: term.length >= 2,
    staleTime: 10_000,
    queryFn: async (): Promise<SearchResult> => {
      if (isFixtureMode()) {
        const q = term.replace(/\s+/g, '').toLowerCase()
        const d = fixtureStore()
        const hit = (v: string) => v.replace(/\s+/g, '').toLowerCase().includes(q)
        return fixtureDelay({
          trucks: d.trucks.filter((x) => hit(x.reg_no)).slice(0, 5).map(({ id, reg_no, status }) => ({ id, reg_no, status })),
          trips: d.trips.filter((x) => hit(x.code)).slice(0, 5).map(({ id, code, status }) => ({ id, code, status })),
        })
      }
      const sb = getSupabase()
      const like = `%${term.replace(/[%_]/g, '').split('').filter((c) => c !== ' ').join('%')}%`
      const [trucks, trips] = await Promise.all([
        sb.from('trucks').select('id, reg_no, status').ilike('reg_no', like).limit(5),
        sb.from('trips').select('id, code, status').ilike('code', like).limit(5),
      ])
      if (trucks.error) throw toAppError(trucks.error)
      if (trips.error) throw toAppError(trips.error)
      return { trucks: trucks.data, trips: trips.data }
    },
  })
}
