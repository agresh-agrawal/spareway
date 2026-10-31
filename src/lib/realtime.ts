import { useEffect } from 'react'
import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import { getSupabase } from './supabase'
import { isFixtureMode } from './fixtures'

type Table = 'alerts' | 'activity_log' | 'loading_progress' | 'trucks' | 'cargo_items'

/**
 * Owner-only realtime: any change on `table` (optionally filtered, e.g. "trip_id=eq.<id>")
 * invalidates the given query keys. Never writes the cache by hand. If the channel fails,
 * the keys are refetched every 30 s instead.
 */
export function useRealtime(table: Table, keys: QueryKey[], filter?: string, enabled = true) {
  const qc = useQueryClient()
  const keyStr = JSON.stringify(keys)

  useEffect(() => {
    if (!enabled || isFixtureMode()) return
    const supabase = getSupabase()
    const invalidate = () => {
      for (const k of JSON.parse(keyStr) as QueryKey[]) qc.invalidateQueries({ queryKey: k })
    }
    let fallback: ReturnType<typeof setInterval> | null = null
    const channel = supabase
      .channel(`rt:${table}:${filter ?? 'all'}:${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) }, invalidate)
      .subscribe((status) => {
        if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') && !fallback) {
          fallback = setInterval(invalidate, 30_000)
        }
        if (status === 'SUBSCRIBED' && fallback) {
          clearInterval(fallback)
          fallback = null
        }
      })
    return () => {
      if (fallback) clearInterval(fallback)
      supabase.removeChannel(channel)
    }
  }, [qc, table, filter, keyStr, enabled])
}
