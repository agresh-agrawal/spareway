import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/lib/queryKeys'
import { useRealtime } from '@/lib/realtime'
import { toAppError } from '@/lib/errors'
import i18n from '@/i18n/setup'
import {
  fetchChipLabels,
  fetchDashboardStats,
  fetchOpenAlerts,
  fetchRecentActivity,
  resolveAlert,
  type Alert,
} from './api'
import { sortProblems } from './lib/problems'

export function useDashboardStats() {
  return useQuery({ queryKey: queryKeys.homeStats, queryFn: fetchDashboardStats })
}

export function useOpenProblems() {
  useRealtime('alerts', [queryKeys.alertsAll])
  return useQuery({ queryKey: queryKeys.alerts(true), queryFn: fetchOpenAlerts, select: sortProblems })
}

export function useChipLabels() {
  return useQuery({ queryKey: ['home', 'chips'], queryFn: fetchChipLabels })
}

export function useRecentActivity() {
  useRealtime('activity_log', [queryKeys.activity])
  return useQuery({ queryKey: queryKeys.activity, queryFn: () => fetchRecentActivity(6) })
}

/** "Done" resolves optimistically; rolls back with a toast on error. */
export function useResolveProblem() {
  const qc = useQueryClient()
  const key = queryKeys.alerts(true)
  return useMutation({
    mutationFn: resolveAlert,
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<Alert[]>(key)
      qc.setQueryData<Alert[]>(key, (old) => old?.filter((a) => a.id !== id))
      return { prev }
    },
    onError: (err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev)
      toast.error(i18n.t(`common:errors.${toAppError(err).code}`))
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.alertsAll })
      qc.invalidateQueries({ queryKey: queryKeys.homeStats })
    },
  })
}
