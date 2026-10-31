import { useEffect, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { useRealtime } from '@/lib/realtime'
import type { PackOptions, PackResult } from '@/types/domain'
import { buildPackItems, computeInputHash } from '../engine'
import { activatePlan, fetchCargo, fetchPlans, fetchProgress, fetchStops, fetchTripBasics, savePlan, type PlanRow } from '../api'
import { getPacker } from '../worker/client'
import { resultFromRow } from '../lib/plan'
import { setTripHasActivePlan } from '../lib/stepState'

/** The packing worker (Comlink), or the engine on the main thread where Workers don't exist. */
export function usePacker() {
  return getPacker()
}

export type PlanStatus = 'loading' | 'error' | 'noCargo' | 'packing' | 'ready'

const PLANNABLE = new Set(['planned', 'loading'])

/**
 * Everything the Load plan step needs for one trip:
 * reads trip, truck, stops, cargo and saved plans; packs in the worker unless a saved plan has the same input
 * hash (then that plan is reused); "Use this plan" saves the plan (if new) and activates it; loading progress
 * of the active plan arrives by realtime.
 */
export function usePlanForTrip(tripId: string) {
  const qc = useQueryClient()
  // sub-keys of the trip / stops / cargo keys, so the other features' invalidations refresh the plan too
  const basics = useQuery({ queryKey: [...queryKeys.trip(tripId), 'planBasics'], queryFn: () => fetchTripBasics(tripId) })
  const stops = useQuery({ queryKey: [...queryKeys.tripStops(tripId), 'plan'], queryFn: () => fetchStops(tripId) })
  const cargo = useQuery({ queryKey: [...queryKeys.tripCargo(tripId), 'plan'], queryFn: () => fetchCargo(tripId) })
  const plans = useQuery({ queryKey: queryKeys.tripPlans(tripId), queryFn: () => fetchPlans(tripId) })
  useRealtime('cargo_items', [queryKeys.tripCargo(tripId)], `trip_id=eq.${tripId}`)

  const input = useMemo(
    () => (basics.data && stops.data && cargo.data ? buildPackItems(cargo.data, stops.data, basics.data.truck) : null),
    [basics.data, stops.data, cargo.data],
  )
  const supportRatio = basics.data?.supportRatio
  const options = useMemo<PackOptions>(() => ({ supportRatio }), [supportRatio])
  const inputHash = useMemo(
    () => (input ? computeInputHash(input.container, input.items, options) : null),
    [input, options],
  )

  const savedPlan: PlanRow | undefined = plans.data?.find((p) => p.input_hash === inputHash)
  const activePlan: PlanRow | undefined = plans.data?.find((p) => p.status === 'active')

  useEffect(() => {
    if (plans.data) setTripHasActivePlan(tripId, Boolean(activePlan))
  }, [tripId, plans.data, activePlan])

  const packed = useQuery({
    queryKey: ['loadPlanner', 'pack', inputHash],
    queryFn: () => getPacker().pack(input!.container, input!.items, options),
    enabled: Boolean(input && inputHash && plans.data && !savedPlan && input.items.length > 0),
    staleTime: Infinity,
    gcTime: 10 * 60_000,
    retry: false,
  })

  const result: PackResult | undefined = useMemo(() => {
    if (!input) return undefined
    if (savedPlan) return resultFromRow(savedPlan, input.container)
    return packed.data
  }, [input, savedPlan, packed.data])

  const progress = useQuery({
    queryKey: queryKeys.planProgress(activePlan?.id ?? 'none'),
    queryFn: () => fetchProgress(activePlan!.id),
    enabled: Boolean(activePlan),
  })
  useRealtime(
    'loading_progress',
    [queryKeys.planProgress(activePlan?.id ?? 'none')],
    `load_plan_id=eq.${activePlan?.id ?? 'none'}`,
    Boolean(activePlan),
  )

  const activate = useMutation({
    mutationFn: async () => {
      if (!result || !basics.data) throw new Error('No plan to use yet')
      const plan = savedPlan ?? (await savePlan(basics.data.trip, result))
      if (plan.status !== 'active') await activatePlan(plan.id)
      return plan
    },
    onSuccess: () => {
      setTripHasActivePlan(tripId, true)
      for (const key of [
        queryKeys.tripPlans(tripId),
        queryKeys.trip(tripId),
        queryKeys.tripsAll,
        queryKeys.homeStats,
        queryKeys.activity,
        queryKeys.alertsAll,
        ['truck'],
      ])
        qc.invalidateQueries({ queryKey: key })
    },
  })

  const baseError = basics.error ?? stops.error ?? cargo.error ?? plans.error
  let status: PlanStatus
  if (baseError) status = 'error'
  else if (!input || !plans.data) status = 'loading'
  else if (input.items.length === 0) status = 'noCargo'
  else if (result) status = 'ready'
  else status = packed.error ? 'error' : 'packing'

  const tripStatus = basics.data?.trip.status ?? ''
  return {
    status,
    error: baseError ?? packed.error ?? null,
    trip: basics.data?.trip,
    truck: basics.data?.truck,
    stops: stops.data ?? [],
    cargo: cargo.data ?? [],
    container: input?.container,
    items: input?.items ?? [],
    options,
    inputHash,
    result,
    savedPlan,
    activePlan,
    /** the active plan is exactly this cargo + truck */
    isActive: Boolean(activePlan && activePlan.input_hash === inputHash),
    /** an older plan is active but the cargo or truck changed since */
    isOutdated: Boolean(activePlan && activePlan.input_hash !== inputHash),
    canActivate: PLANNABLE.has(tripStatus),
    progress: progress.data ?? [],
    activate: activate.mutateAsync,
    activating: activate.isPending,
    retry: () => {
      for (const q of [basics, stops, cargo, plans]) if (q.error) void q.refetch()
      if (packed.error) void packed.refetch()
    },
  }
}

export type PlanForTrip = ReturnType<typeof usePlanForTrip>
