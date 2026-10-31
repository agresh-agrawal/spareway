import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { useRealtime } from '@/lib/realtime'
import { useLowData } from '@/lib/lowData'
import { toast } from 'sonner'
import i18n from '@/i18n/setup'
import { enqueue, isOfflineError } from '@/features/offline'
import type { LoaderJob, LoaderStepStatus } from '@/types/domain'
import { createLoaderLink, disableLoaderLink, getJob, getLinkState, getLoaderAlerts, getProgress, updateStep } from './api'
import { pollInterval } from './lib/position'

// ---------- owner ----------

const linkKey = (tripId: string) => [...queryKeys.trip(tripId), 'loaderLink'] as const

export function useLinkState(tripId: string) {
  return useQuery({ queryKey: linkKey(tripId), queryFn: () => getLinkState(tripId) })
}

export function useCreateLink(tripId: string) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: () => createLoaderLink(tripId), onSuccess: () => qc.invalidateQueries({ queryKey: linkKey(tripId) }) })
}

export function useDisableLink(tripId: string) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: () => disableLoaderLink(tripId), onSuccess: () => qc.invalidateQueries({ queryKey: linkKey(tripId) }) })
}

/** Live loading progress of the active plan (owners get realtime; the loader page polls). */
export function useLoadingProgress(planId: string | null | undefined) {
  useRealtime('loading_progress', [queryKeys.planProgress(planId ?? '')], planId ? `load_plan_id=eq.${planId}` : undefined, Boolean(planId))
  return useQuery({ queryKey: queryKeys.planProgress(planId ?? ''), queryFn: () => getProgress(planId!), enabled: Boolean(planId) })
}

export function useLoaderAlerts(tripId: string) {
  useRealtime('alerts', [[...queryKeys.alertsAll, { tripId, loader: true }]])
  return useQuery({ queryKey: [...queryKeys.alertsAll, { tripId, loader: true }], queryFn: () => getLoaderAlerts(tripId) })
}

// ---------- loader page ----------

function usePageVisible(): boolean {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden')
  useEffect(() => {
    const on = () => setVisible(document.visibilityState !== 'hidden')
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [])
  return visible
}

/** loader_get_job every 5 s while the page is visible (10 s low-data), paused while hidden. */
export function useLoaderJob(token: string) {
  const visible = usePageVisible()
  const { lowData } = useLowData()
  return useQuery({
    queryKey: queryKeys.loaderJob(token),
    queryFn: () => getJob(token),
    refetchInterval: pollInterval(visible, lowData),
    refetchIntervalInBackground: false,
    staleTime: 0,
    retry: (n, err) => (err as { code?: string }).code !== 'LINK_INVALID' && n < 2,
  })
}

export function useUpdateStep(token: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { planId: string; step: number; status: LoaderStepStatus; note?: string }) => {
      try {
        await updateStep(token, v.planId, v.step, v.status, v.note)
      } catch (e) {
        // no internet: the tap counts on this phone now and is sent later, in order (offline queue kind "loader_step")
        if (!isOfflineError(e)) throw e
        enqueue('loader_step', { token, ...v })
        qc.setQueryData<LoaderJob>(queryKeys.loaderJob(token), (old) =>
          old && 'progress' in old
            ? { ...old, progress: old.progress.map((p) => (p.step === v.step ? { ...p, status: v.status, note: v.note ?? '' } : p)) }
            : old,
        )
        toast(i18n.t('offline:queued'))
      }
    },
    onSettled: () => {
      if (navigator.onLine) void qc.invalidateQueries({ queryKey: queryKeys.loaderJob(token) }) // own writes → refetch now
    },
  })
}
