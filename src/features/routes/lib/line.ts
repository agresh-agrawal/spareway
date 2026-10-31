// Geometry along a route line: chainage (km from the start), projecting points onto the line, and where the
// line first enters a circle. Equirectangular per segment — accurate to metres at these distances.
import { kmBetween } from '@/lib/geo'

export type LngLat = [number, number]

const KM_PER_DEG = 111.32

export interface Line {
  coords: LngLat[]
  /** cumulative km at each vertex */
  cum: number[]
  lengthKm: number
}

export function makeLine(coords: LngLat[]): Line {
  const cum = [0]
  for (let i = 1; i < coords.length; i++) {
    const [a, b] = [coords[i - 1], coords[i]]
    cum.push(cum[i - 1] + kmBetween(a[1], a[0], b[1], b[0]))
  }
  return { coords, cum, lengthKm: cum[cum.length - 1] ?? 0 }
}

/** Closest point of segment a→b to p: fraction t (0–1) and distance in km. */
function closestOnSegment(p: LngLat, a: LngLat, b: LngLat): { t: number; km: number } {
  const kx = KM_PER_DEG * Math.cos(((a[1] + b[1]) / 2) * (Math.PI / 180))
  const ax = 0
  const ay = 0
  const bx = (b[0] - a[0]) * kx
  const by = (b[1] - a[1]) * KM_PER_DEG
  const px = (p[0] - a[0]) * kx
  const py = (p[1] - a[1]) * KM_PER_DEG
  const len2 = bx * bx + by * by
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * bx + (py - ay) * by) / len2)) : 0
  return { t, km: Math.hypot(px - t * bx, py - t * by) }
}

export interface Projection {
  /** chainage of the closest point, km */
  km: number
  /** distance from the line, km */
  offKm: number
  segment: number
}

/** Where p sits on the line. `fromSegment` lets stops be matched in order (a later stop never maps before an earlier one). */
export function project(line: Line, p: LngLat, fromSegment = 0): Projection {
  let best: Projection = { km: 0, offKm: Infinity, segment: 0 }
  for (let i = Math.max(0, fromSegment); i < line.coords.length - 1; i++) {
    const r = closestOnSegment(p, line.coords[i], line.coords[i + 1])
    if (r.km < best.offKm) best = { km: line.cum[i] + r.t * (line.cum[i + 1] - line.cum[i]), offKm: r.km, segment: i }
  }
  if (line.coords.length === 1) best = { km: 0, offKm: kmBetween(p[1], p[0], line.coords[0][1], line.coords[0][0]), segment: 0 }
  return best
}

/** The point at chainage km. */
export function pointAt(line: Line, km: number): LngLat {
  const { coords, cum } = line
  if (coords.length === 0) return [0, 0]
  if (km <= 0) return coords[0]
  for (let i = 1; i < coords.length; i++) {
    if (cum[i] >= km) {
      const seg = cum[i] - cum[i - 1]
      const t = seg > 0 ? (km - cum[i - 1]) / seg : 0
      return [coords[i - 1][0] + t * (coords[i][0] - coords[i - 1][0]), coords[i - 1][1] + t * (coords[i][1] - coords[i - 1][1])]
    }
  }
  return coords[coords.length - 1]
}

/**
 * First chainage in [fromKm, toKm] where the line comes within radiusKm of centre, or null.
 * If the line is already inside at fromKm, returns fromKm.
 */
export function firstEntry(line: Line, centre: LngLat, radiusKm: number, fromKm = 0, toKm = Infinity): number | null {
  const dist = (km: number) => {
    const [lng, lat] = pointAt(line, km)
    return kmBetween(lat, lng, centre[1], centre[0])
  }
  const end = Math.min(toKm, line.lengthKm)
  if (dist(fromKm) <= radiusKm) return fromKm
  for (let i = 0; i < line.coords.length - 1; i++) {
    const a = line.cum[i]
    const b = line.cum[i + 1]
    if (b < fromKm || a > end) continue
    const r = closestOnSegment(centre, line.coords[i], line.coords[i + 1])
    if (r.km > radiusKm) continue
    // inside somewhere on this segment: binary search the crossing between its start and the closest point
    let lo = Math.max(a, fromKm)
    let hi = Math.min(a + r.t * (b - a), end)
    if (dist(lo) <= radiusKm) return lo
    if (dist(hi) > radiusKm) continue
    for (let k = 0; k < 30; k++) {
      const mid = (lo + hi) / 2
      if (dist(mid) <= radiusKm) hi = mid
      else lo = mid
    }
    return hi
  }
  return null
}
