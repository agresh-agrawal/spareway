import { useMemo } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { useRealtime } from '@/lib/realtime'
import { buildPackItems, computeInputHash, fitAdditional, pack, usePacker } from '@/features/load-planner'

type Packer = ReturnType<typeof usePacker>
import type { LngLat } from '@/features/routes'
import type { PackContainer, PackItem, PackOptions, PackResult, Placement } from '@/types/domain'
import {
  acceptExtraLoad,
  fetchListings,
  fetchPlannableTripsWithStops,
  fetchStepData,
  postListing,
  removeListing,
  saveAndActivatePlan,
  saveSuggestion,
  type ListingFilter,
  type ListingRow,
  type NewListing,
  type StepData,
} from './api'
import { corridorKm, evaluateCandidates, listingPackItems, type Candidate, type SpaceCheck } from './lib/candidates'
import { setTripHasExtra } from './lib/stepState'

const placementsOf = (json: unknown) => (Array.isArray(json) ? (json as Placement[]) : [])

/** Route line: the chosen route, else straight lines through the stops (approximate). */
export function tripLine(d: Pick<StepData, 'routeLine' | 'stops'>): { line: LngLat[]; approximate: boolean } {
  if (d.routeLine?.coordinates?.length) return { line: d.routeLine.coordinates as LngLat[], approximate: false }
  return { line: d.stops.map((s) => [s.lng, s.lat] as LngLat), approximate: true }
}

export interface BasePlan {
  container: PackContainer
  items: PackItem[]
  /** boxes now in the plan: the active plan, else the current cargo packed (not saved) */
  placements: Placement[]
  /** loading has started → loaded boxes stay where they are; else everything can be packed again */
  started: boolean
  /** boxes already loaded (kept fixed when started) */
  loaded: Placement[]
}

function basePlan(d: StepData, options: PackOptions): BasePlan {
  const { container, items } = buildPackItems(d.cargo, d.stops, d.truck)
  const placements = d.activePlan ? placementsOf(d.activePlan.placements) : pack(container, items, options).placements
  const loadedKeys = new Set(d.loadedKeys)
  const started = d.trip.status === 'loading' || loadedKeys.size > 0
  return { container, items, placements, started, loaded: placements.filter((p) => loadedKeys.has(p.key)) }
}

/** OK only if nothing new is left out — neither the load nor cargo that fitted before. */
export function spaceVerdict(unplaced: PackResult['unplaced'], alreadyMissing = 0): SpaceCheck {
  if (unplaced.length <= alreadyMissing) return 'OK'
  return unplaced.some((u) => u.reason === 'ORDER_CONFLICT') ? 'ORDER_CONFLICT' : 'NO_SPACE'
}

/** Same rule as "Add to trip": pack everything again before loading starts, else fit around the loaded boxes. */
export function fitWithLoad(
  packer: Pick<Packer, 'pack' | 'fitAdditional'>,
  base: BasePlan,
  extra: PackItem[],
  options: PackOptions,
): Promise<PackResult> {
  const all = [...base.items, ...extra]
  return base.started ? packer.fitAdditional(base.container, base.loaded, all, options) : packer.pack(base.container, all, options)
}

/**
 * Extra loads step: open listings checked against the trip (corridor, direction, weight left, space left in
 * the packed truck via the worker, profit) and sorted by profit.
 */
export function useExtraLoads(tripId: string) {
  const packer = usePacker()
  const data = useQuery({ queryKey: queryKeys.tripExtra(tripId), queryFn: () => fetchStepData(tripId) })
  useRealtime('cargo_items', [queryKeys.tripExtra(tripId)], `trip_id=eq.${tripId}`)
  const d = data.data

  const options = useMemo<PackOptions>(() => ({ supportRatio: d?.settings.support_ratio }), [d?.settings.support_ratio])
  const base = useMemo(() => (d ? basePlan(d, options) : null), [d, options])
  const booked = d ? d.cargo.reduce((a, c) => a + Number(c.weight_kg) * Number(c.quantity), 0) : 0

  // first pass without the space check → which loads still need one
  const first = useMemo(() => {
    if (!d) return []
    const { line, approximate } = tripLine(d)
    return evaluateCandidates({
      listings: d.listings,
      line,
      approximate,
      stops: d.stops,
      settings: d.settings,
      truck: d.truck,
      remainingPayloadKg: Number(d.truck.payload_kg) - booked,
    })
  }, [d, booked])

  const toCheck = first.filter((c) => c.recommended || c.feasibility.reason === 'LOW_MARGIN')
  const spaceKey = base ? `${base.started}:${computeInputHash(base.container, base.items, options, base.started ? base.loaded : [])}` : 'none'
  // boxes the current plan already leaves out don't count against a new load
  const baseMissing = base ? base.items.length - base.placements.length : 0
  const space = useQuery({
    queryKey: [...queryKeys.tripExtra(tripId), 'space', spaceKey, toCheck.map((c) => `${c.listingId}:${c.loadOrder}:${c.unloadOrder}`).join(',')],
    enabled: Boolean(base) && toCheck.length > 0,
    staleTime: Infinity,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const out = new Map<string, SpaceCheck>()
      for (const c of toCheck) {
        const extra = listingPackItems(c)
        const r = await fitWithLoad(packer, base!, extra, options)
        out.set(c.listingId, spaceVerdict(r.unplaced, baseMissing))
      }
      return out
    },
  })

  const candidates: Candidate[] = useMemo(() => {
    if (!d || !space.data) return first
    const { line, approximate } = tripLine(d)
    return evaluateCandidates({
      listings: d.listings,
      line,
      approximate,
      stops: d.stops,
      settings: d.settings,
      truck: d.truck,
      remainingPayloadKg: Number(d.truck.payload_kg) - booked,
      space: space.data,
    })
  }, [d, booked, first, space.data])

  const recommended = candidates.filter((c) => c.recommended)
  const status: 'loading' | 'error' | 'checking' | 'ready' = data.error
    ? 'error'
    : !d
      ? 'loading'
      : toCheck.length > 0 && !space.data
        ? 'checking'
        : 'ready'
  if (d) setTripHasExtra(tripId, d.cargo.some((c) => c.source === 'extra_load'))

  return {
    status,
    error: data.error ?? space.error ?? null,
    data: d,
    base,
    options,
    candidates,
    recommended,
    notSuitable: candidates.filter((c) => !c.recommended),
    remainingPayloadKg: d ? Number(d.truck.payload_kg) - booked : 0,
    corridorKm: d ? corridorKm(d.settings.corridor_km) : 0,
    approximate: d ? tripLine(d).approximate : false,
    retry: () => void data.refetch(),
  }
}

export type ExtraLoads = ReturnType<typeof useExtraLoads>

/**
 * "Add to trip": trip_extra_loads row → accept_extra_load (stops + cargo) → new plan → activate.
 * Loading not started → pack everything again; boxes already loaded → keep them fixed and fit the rest around.
 */
export async function addToTrip(
  tripId: string,
  c: Candidate,
  run: { pack: typeof pack; fitAdditional: typeof fitAdditional } = { pack, fitAdditional },
): Promise<{ before: number; after: number; result: PackResult }> {
  const before0 = await fetchStepData(tripId)
  const before = before0.activePlan
    ? Number((before0.activePlan.metrics as { volumeUsedPct?: number }).volumeUsedPct ?? 0)
    : basePlanMetric(before0)
  const extraId = await saveSuggestion(tripId, c)
  await acceptExtraLoad(extraId, c.pickupAfterSeq, c.dropAfterSeq)
  const d = await fetchStepData(tripId)
  const { container, items } = buildPackItems(d.cargo, d.stops, d.truck)
  const options: PackOptions = { supportRatio: d.settings.support_ratio }
  const loaded = new Set(d.loadedKeys)
  const started = d.trip.status === 'loading' || loaded.size > 0
  let result: PackResult
  if (!started || !d.activePlan) result = run.pack(container, items, options)
  else {
    // keep loaded boxes where they are; their drop stop may have a new seq after the insert
    const unloadOf = new Map(items.map((i) => [i.key, i.unloadOrder]))
    const fixed = placementsOf(d.activePlan.placements)
      .filter((p) => loaded.has(p.key))
      .map((p) => ({ ...p, unloadOrder: unloadOf.get(p.key) ?? p.unloadOrder }))
    result = run.fitAdditional(container, fixed, items, options)
  }
  await saveAndActivatePlan(d.trip, result)
  return { before, after: result.metrics.volumeUsedPct, result }
}

function basePlanMetric(d: StepData): number {
  const { container, items } = buildPackItems(d.cargo, d.stops, d.truck)
  return pack(container, items, { supportRatio: d.settings.support_ratio }).metrics.volumeUsedPct
}

export function useAddToTrip(tripId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (c: Candidate) => addToTrip(tripId, c),
    onSettled: () => {
      setTripHasExtra(tripId, true)
      for (const key of [
        queryKeys.trip(tripId),
        queryKeys.tripPlans(tripId),
        queryKeys.tripRoutes(tripId),
        queryKeys.tripsAll,
        queryKeys.listingsAll,
        queryKeys.tripFinancials(tripId),
        queryKeys.activity,
        queryKeys.alertsAll,
        queryKeys.homeStats,
      ])
        qc.invalidateQueries({ queryKey: key })
    },
  })
}

// ---------- marketplace ----------

export function useListings(filter: ListingFilter) {
  return useQuery({ queryKey: queryKeys.listings(filter), queryFn: () => fetchListings(filter) })
}

export function usePostListing() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: NewListing) => postListing(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.listingsAll }),
  })
}

export function useRemoveListing() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => removeListing(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.listingsAll }),
  })
}

export function usePlannableTrips() {
  return useQuery({ queryKey: [...queryKeys.tripsAll, 'withStops'], queryFn: fetchPlannableTripsWithStops })
}

/** Straight lines between stops cut corners, so the rough trip match allows twice the corridor. */
export const FIND_TRIP_KM = 80

/** The planned trip a listing fits best (near the stops line, right direction, least off-route), or null. */
export function bestTripFor(listing: ListingRow, trips: Awaited<ReturnType<typeof fetchPlannableTripsWithStops>>, corridor = FIND_TRIP_KM) {
  let best: { tripId: string; off: number } | null = null
  for (const { trip, stops } of trips) {
    if (stops.length < 2) continue
    const [c] = evaluateCandidates({
      listings: [{ ...listing, status: 'open' }],
      line: stops.map((s) => [s.lng, s.lat] as LngLat),
      approximate: true,
      stops,
      settings: { corridor_km: corridor, road_factor: 1.25, handling_inr_per_kg: 0, waiting_cost_inr_per_h: 0, delay_penalty_inr_per_min: 0, min_margin_inr: -Infinity, avg_speed_kmph: 45 },
      truck: { cost_per_km_inr: 0 },
      remainingPayloadKg: Infinity,
    })
    if (!c || c.feasibility.reason === 'OFF_CORRIDOR' || c.feasibility.reason === 'WRONG_DIRECTION') continue
    if (!best || c.offKm < best.off) best = { tripId: trip.id, off: c.offKm }
  }
  return best?.tripId ?? null
}
