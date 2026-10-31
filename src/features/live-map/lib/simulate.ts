import { kmBetween, type LngLat } from '@/lib/geo'

/** Cumulative km at each point of a line. */
export function cumulativeKm(line: LngLat[]): number[] {
  const out = [0]
  for (let i = 1; i < line.length; i++) out.push(out[i - 1] + kmBetween(line[i - 1][1], line[i - 1][0], line[i][1], line[i][0]))
  return out
}

/** Point at `fraction` (0–1) of the line's length, plus the heading of that segment in degrees. */
export function pointAlong(line: LngLat[], fraction: number, cum: number[] = cumulativeKm(line)): { point: LngLat; km: number } {
  if (line.length === 0) return { point: [0, 0], km: 0 }
  if (line.length === 1) return { point: line[0], km: 0 }
  const total = cum[cum.length - 1]
  const target = Math.max(0, Math.min(1, fraction)) * total
  let i = 1
  while (i < cum.length - 1 && cum[i] < target) i++
  const segLen = cum[i] - cum[i - 1]
  const t = segLen === 0 ? 0 : (target - cum[i - 1]) / segLen
  const [a, b] = [line[i - 1], line[i]]
  return { point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], km: target }
}

export const SPEED_UP = 60

/**
 * Simulated share of the trip done at `now` (Architecture F15): real time since departure counts
 * normally, time since the page opened runs ×60 so trucks visibly move. Capped at 98 % until delivered.
 */
export function simulatedFraction(departure: number, durationMin: number, now: number, pageOpened: number): number {
  if (!Number.isFinite(departure) || durationMin <= 0) return 0
  const realMs = Math.max(0, pageOpened - departure)
  const fastMs = Math.max(0, now - pageOpened) * SPEED_UP
  return Math.min(0.98, (realMs + fastMs) / (durationMin * 60_000))
}

/** Index of the next stop ahead of `km` along the trip, using each stop's km on the line. */
export function nextStopIndex(stopKms: number[], km: number): number {
  const i = stopKms.findIndex((s) => s > km + 0.5)
  return i === -1 ? stopKms.length - 1 : i
}

/** km along the line closest to a point (for placing stops on a route). */
export function kmOfPoint(line: LngLat[], p: LngLat, cum: number[] = cumulativeKm(line)): number {
  let best = Infinity
  let at = 0
  for (let i = 0; i < line.length; i++) {
    const d = kmBetween(line[i][1], line[i][0], p[1], p[0])
    if (d < best) {
      best = d
      at = cum[i]
    }
  }
  return at
}

/** Simulated speed (km/h) and fuel (%) — plain numbers derived from the trip, marked Simulated in the UI. */
export function simulatedReadings(avgSpeedKmph: number, startFuelPct: number | null, kmDone: number, mileageKmpl: number, now: number) {
  const wobble = Math.sin(now / 9_000) * 6
  const speed = Math.max(0, Math.round(avgSpeedKmph + wobble))
  const tankL = 400
  const fuel = startFuelPct === null ? null : Math.max(5, Math.round(startFuelPct - (100 * kmDone) / mileageKmpl / tankL))
  return { speed, fuel }
}

/** Minutes until the next rest break (break every `breakAfterH` hours of driving). */
export function minutesToBreak(drivenMin: number, breakAfterH: number): number {
  const every = breakAfterH * 60
  if (every <= 0) return Infinity
  return Math.round(every - (drivenMin % every))
}
