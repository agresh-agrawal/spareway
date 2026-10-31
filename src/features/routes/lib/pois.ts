// Route POIs (table pois): tolls, dhabas, parking, hotels, checkpoints, city no-entry zones.
import type { LngLat } from './line'

export interface PoiInput {
  id: string
  kind: string
  name: string
  lat: number
  lng: number
  city: string
  data: unknown
}

export const REST_KINDS = new Set(['dhaba', 'parking', 'hotel'])

export interface NoEntryRule {
  windows: [number, number][]
  radiusKm: number
  /** 'city_entry' or a corridor such as "Gujarat_to_Thane_Bhiwandi_Kalyan" */
  direction: string
  area: string
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** data.no_entry [["17:00","21:00"], …] + radius → minutes of the day (IST). */
export function noEntryRule(poi: PoiInput): NoEntryRule | null {
  const d = (poi.data ?? {}) as { no_entry?: unknown; radius_km?: unknown; direction?: unknown; area?: unknown }
  if (!Array.isArray(d.no_entry)) return null
  const windows = d.no_entry
    .filter((w): w is [string, string] => Array.isArray(w) && typeof w[0] === 'string' && typeof w[1] === 'string')
    .map(([a, b]) => [toMin(a), toMin(b)] as [number, number])
  if (windows.length === 0) return null
  return {
    windows,
    radiusKm: Number(d.radius_km) > 0 ? Number(d.radius_km) : 10,
    direction: typeof d.direction === 'string' ? d.direction : 'city_entry',
    area: typeof d.area === 'string' ? d.area : '',
  }
}

/** Toll for the truck's axle count from data.rate_inr {"2": …, "3": …, …, "7": …} (nearest class if missing). */
export function tollRate(poi: PoiInput, axles: number): number {
  const rates = ((poi.data ?? {}) as { rate_inr?: Record<string, number> }).rate_inr
  if (!rates) return 0
  const keys = Object.keys(rates)
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b)
  if (keys.length === 0) return 0
  const want = Math.max(keys[0], Math.min(keys[keys.length - 1], Math.round(axles || 2)))
  const key = keys.reduce((best, k) => (Math.abs(k - want) < Math.abs(best - want) ? k : best), keys[0])
  return Number(rates[String(key)]) || 0
}

export const poiLngLat = (p: PoiInput): LngLat => [p.lng, p.lat]

/** Minutes to wait at time-of-day `tod` (0–1439) until no window covers it; windows may wrap past midnight. */
export function waitForWindows(windows: [number, number][], tod: number): { waitMin: number; until: number } {
  let t = ((tod % 1440) + 1440) % 1440
  let wait = 0
  for (let guard = 0; guard < 4; guard++) {
    const w = windows.find(([from, to]) => (from <= to ? t >= from && t < to : t >= from || t < to))
    if (!w) break
    const [, to] = w
    const add = (((to - t) % 1440) + 1440) % 1440 || 1440
    wait += add
    t = to % 1440
  }
  return { waitMin: wait, until: t }
}
