import { useEffect, useMemo, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { boundsOf, bboxKey } from '@/lib/geo'
import type { CostBreakdown, GeoLineString, RouteVariant } from '@/types/domain'
import { chooseRoute, fetchPois, fetchRouteBasics, fetchRouteOptions, requestRoutes, saveRoutes, type RouteRow, type StopRow } from './api'
import { bestIndex, costRoute } from './lib/cost'
import { makeLine, project, type LngLat } from './lib/line'
import { planSchedule, type RoutePlan } from './lib/schedule'
import { setTripHasRoute } from './lib/stepState'

const IST_MS = 330 * 60_000

/** The trip's departure, else tomorrow 6:00 am IST (owner's answer: no departure entry on this step). */
export function departureFor(planned: string | null | undefined, now: Date = new Date()): string {
  if (planned) return new Date(planned).toISOString()
  const ist = new Date(now.getTime() + IST_MS)
  const tomorrow6 = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + 1, 6, 0) - IST_MS
  return new Date(tomorrow6).toISOString()
}

/** Saved routes still fit the stops: every stop within 15 km of each line, in order. */
export function routesFitStops(rows: Pick<RouteRow, 'geometry'>[], stops: Pick<StopRow, 'lat' | 'lng' | 'seq'>[]): boolean {
  if (rows.length === 0) return false
  const ordered = [...stops].sort((a, b) => a.seq - b.seq)
  return rows.every((r) => {
    const g = r.geometry as unknown as GeoLineString
    if (!g || !Array.isArray(g.coordinates) || g.coordinates.length < 2) return false
    const line = makeLine(g.coordinates as LngLat[])
    let seg = 0
    for (const s of ordered) {
      const pr = project(line, [s.lng, s.lat], seg)
      if (pr.offKm > 15) return false
      seg = pr.segment
    }
    return true
  })
}

export interface PlannedRoute {
  row: RouteRow
  variant: RouteVariant['variant']
  distanceKm: number
  geometry: GeoLineString
  plan: RoutePlan
  cost: CostBreakdown
  best: boolean
}

/**
 * Route step data: saved routes (or fresh ones from route-plan when there are none / the stops changed),
 * POIs along them, each route planned (breaks, waits, ETAs) and costed with the current Settings, Best marked,
 * and "Choose".
 */
export function useRoutePlanner(tripId: string) {
  const qc = useQueryClient()
  const basics = useQuery({ queryKey: [...queryKeys.trip(tripId), 'routeBasics'], queryFn: () => fetchRouteBasics(tripId) })
  const options = useQuery({ queryKey: queryKeys.tripRoutes(tripId), queryFn: () => fetchRouteOptions(tripId) })

  const fresh = useMutation({
    mutationFn: async () => {
      const b = basics.data!
      const routes = await requestRoutes(b.trip, b.truck, b.stops)
      return saveRoutes(tripId, routes)
    },
    onSuccess: (rows) => {
      qc.setQueryData(queryKeys.tripRoutes(tripId), rows)
      qc.invalidateQueries({ queryKey: queryKeys.trip(tripId) })
    },
  })

  const needFresh = Boolean(
    basics.data && options.data && basics.data.stops.length >= 2 && !routesFitStops(options.data, basics.data.stops),
  )
  const asked = useRef(false)
  useEffect(() => {
    if (needFresh && !asked.current && !fresh.isPending) {
      asked.current = true
      fresh.mutate()
    }
  }, [needFresh, fresh])

  const usable = useMemo(() => (needFresh ? [] : (options.data ?? [])), [needFresh, options.data])
  const bbox = useMemo(() => {
    const pts = usable.flatMap((r) => ((r.geometry as unknown as GeoLineString)?.coordinates ?? []) as LngLat[])
    const b = boundsOf(pts)
    if (!b) return null
    const pad = 0.1
    return [b[0][0] - pad, b[0][1] - pad, b[1][0] + pad, b[1][1] + pad] as [number, number, number, number]
  }, [usable])
  const pois = useQuery({
    queryKey: queryKeys.pois(bbox ? bboxKey([[bbox[0], bbox[1]], [bbox[2], bbox[3]]]) : 'none'),
    queryFn: () => fetchPois(bbox!),
    enabled: Boolean(bbox),
    staleTime: 10 * 60_000,
  })

  const departure = useMemo(() => departureFor(basics.data?.trip.planned_departure), [basics.data?.trip.planned_departure])

  const routes: PlannedRoute[] = useMemo(() => {
    if (!basics.data || !pois.data || usable.length === 0) return []
    const { stops, settings, truck } = basics.data
    const list = usable.map((row) => {
      const geometry = row.geometry as unknown as GeoLineString
      const distanceKm = Number(row.distance_km)
      const plan = planSchedule(
        { distanceKm, durationMin: Number(row.duration_min), geometry },
        stops,
        pois.data,
        settings,
        departure,
        Number(truck.axles) || 2,
      )
      return { row, variant: row.variant as RouteVariant['variant'], distanceKm, geometry, plan, cost: costRoute(distanceKm, plan, truck, settings), best: false }
    })
    const b = bestIndex(list)
    if (b >= 0) list[b].best = true
    return list
  }, [basics.data, pois.data, usable, departure])

  const selected = routes.find((r) => r.row.is_selected || r.row.id === basics.data?.trip.selected_route_id)
  useEffect(() => {
    if (basics.data) setTripHasRoute(tripId, Boolean(basics.data.trip.selected_route_id))
  }, [tripId, basics.data])

  const choose = useMutation({
    mutationFn: (r: PlannedRoute) =>
      chooseRoute({
        trip: basics.data!.trip,
        routeId: r.row.id,
        variant: r.variant,
        distanceKm: r.distanceKm,
        departure,
        plan: r.plan,
        cost: r.cost,
      }),
    onSuccess: () => {
      setTripHasRoute(tripId, true)
      for (const key of [
        queryKeys.tripRoutes(tripId),
        queryKeys.trip(tripId),
        queryKeys.tripsAll,
        queryKeys.tripFinancials(tripId),
        queryKeys.activity,
        queryKeys.alertsAll,
        queryKeys.homeStats,
      ])
        qc.invalidateQueries({ queryKey: key })
    },
  })

  const error = basics.error ?? options.error ?? fresh.error ?? pois.error ?? null
  let status: 'loading' | 'error' | 'fewStops' | 'ready'
  if (basics.data && basics.data.stops.length < 2) status = 'fewStops'
  else if (routes.length > 0) status = 'ready'
  else if (error) status = 'error'
  else status = 'loading'

  return {
    status,
    error,
    basics: basics.data,
    departure,
    routes,
    selected,
    pois: pois.data ?? [],
    choose: choose.mutateAsync,
    choosing: choose.isPending ? choose.variables?.row.id : undefined,
    retry: () => {
      if (basics.error) void basics.refetch()
      if (options.error) void options.refetch()
      if (pois.error) void pois.refetch()
      if (fresh.error || needFresh) {
        asked.current = false
        fresh.reset()
      }
    },
  }
}

export type RoutePlanner = ReturnType<typeof useRoutePlanner>

/** The chosen route of a trip with its plan (for other features, e.g. extra loads / earnings). */
export function useSelectedRoute(tripId: string) {
  const p = useRoutePlanner(tripId)
  return { status: p.status, route: p.selected ?? null, departure: p.departure }
}
