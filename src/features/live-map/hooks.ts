import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/app/auth/AuthProvider'
import { queryKeys } from '@/lib/queryKeys'
import { useRealtime } from '@/lib/realtime'
import { useLowData } from '@/lib/lowData'
import type { LngLat } from '@/lib/geo'
import { getLiveData, type LiveTrip, type Truck } from './api'
import { cumulativeKm, kmOfPoint, minutesToBreak, nextStopIndex, pointAlong, simulatedFraction, simulatedSpeed } from './lib/simulate'

export interface LiveTruck {
  truck: Truck
  /** null → no position known */
  position: LngLat | null
  trip: LiveTrip | null
  line: LngLat[] | null
  approximate: boolean
  progressPct: number
  kmLeft: number | null
  arrivesAt: number | null
  speedKmph: number | null
  breakInMin: number | null
  fromStop: string | null
  toStop: string | null
}

export function useLiveData() {
  useRealtime('trucks', [[...queryKeys.trucks, 'live']])
  return useQuery({ queryKey: [...queryKeys.trucks, 'live'], queryFn: getLiveData })
}

/** Simulated fleet, recomputed every 3 s (Architecture F15). */
export function useLiveFleet(): { fleet: LiveTruck[]; isLoading: boolean; error: unknown; refetch: () => void } {
  const { settings } = useAuth()
  const { lowData } = useLowData()
  const q = useLiveData()
  const opened = useRef(Date.now())
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), lowData ? 10_000 : 3_000)
    return () => clearInterval(id)
  }, [lowData])

  const speed = Number(settings?.avg_speed_kmph ?? 45)
  const roadFactor = Number(settings?.road_factor ?? 1.25)
  const breakAfter = Number(settings?.break_after_drive_h ?? 5)

  // static per-trip geometry
  const tripGeo = useMemo(() => {
    const m = new Map<string, { line: LngLat[]; cum: number[]; stopKms: number[]; durationMin: number; approximate: boolean }>()
    for (const t of q.data?.trips ?? []) {
      const stopLine = t.stops.map((s) => [s.lng, s.lat] as LngLat)
      const line = t.route ? (t.route.geometry.coordinates as LngLat[]) : stopLine
      if (line.length < 2) continue
      const cum = cumulativeKm(line)
      const totalKm = t.route?.distanceKm ?? cum[cum.length - 1] * roadFactor
      const durationMin = t.route?.durationMin ?? (totalKm / Math.max(10, speed)) * 60
      const stopKms = t.stops.map((s) => kmOfPoint(line, [s.lng, s.lat], cum))
      m.set(t.id, { line, cum, stopKms, durationMin, approximate: !t.route })
    }
    return m
  }, [q.data, speed, roadFactor])

  const fleet = useMemo<LiveTruck[]>(() => {
    const data = q.data
    if (!data) return []
    return data.trucks.map((truck) => {
      const trip = data.trips.find((t) => t.truckId === truck.id) ?? null
      const geo = trip ? tripGeo.get(trip.id) : undefined
      const base: LiveTruck = {
        truck,
        position: truck.last_lat !== null && truck.last_lng !== null ? [truck.last_lng, truck.last_lat] : null,
        trip,
        line: null,
        approximate: false,
        progressPct: 0,
        kmLeft: null,
        arrivesAt: null,
        speedKmph: null,
        breakInMin: null,
        fromStop: null,
        toStop: null,
      }
      if (!trip || !geo) return base
      if (trip.status === 'loading') return { ...base, position: geo.line[0], line: geo.line, approximate: geo.approximate, fromStop: trip.stops[0]?.name ?? null, toStop: trip.stops[1]?.name ?? null }
      const dep = trip.departure ? new Date(trip.departure).getTime() : now
      const fraction = simulatedFraction(dep, geo.durationMin, now, opened.current)
      const { point, km } = pointAlong(geo.line, fraction, geo.cum)
      const totalKm = geo.cum[geo.cum.length - 1]
      const scale = trip.route ? trip.route.distanceKm / totalKm : roadFactor
      const next = nextStopIndex(geo.stopKms, km)
      const minutesLeft = geo.durationMin * (1 - fraction)
      return {
        ...base,
        position: point,
        line: geo.line,
        approximate: geo.approximate,
        progressPct: Math.round(fraction * 100),
        kmLeft: Math.round((totalKm - km) * scale),
        arrivesAt: now + minutesLeft * 60_000, // real ETA at normal speed
        speedKmph: simulatedSpeed(speed, now),
        breakInMin: minutesToBreak(fraction * geo.durationMin, breakAfter),
        fromStop: trip.stops[Math.max(0, next - 1)]?.name ?? null,
        toStop: trip.stops[next]?.name ?? null,
      }
    })
  }, [q.data, tripGeo, now, speed, roadFactor, breakAfter])

  return { fleet, isLoading: q.isLoading, error: q.error, refetch: () => void q.refetch() }
}
