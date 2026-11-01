// Spareway navigation (driver link): where the truck is on the planned truck route, what is left, the next turns
// and halts ahead, off-route check. Pure; the route is the owner's chosen truck route (ORS driving-hgv), so turns
// are worked out from its shape — not a turn-by-turn feed. Tested with Vitest.
import { kmBetween, type LngLat } from '@/lib/geo'

export type TurnDir = 'left' | 'right' | 'sharpLeft' | 'sharpRight' | 'slightLeft' | 'slightRight' | 'uturn'

export interface Turn {
  km: number
  dir: TurnDir
  /** signed change of direction, degrees (+ = right) */
  angle: number
}

export interface RouteIndex {
  line: LngLat[]
  cum: number[]
  totalKm: number
  turns: Turn[]
}

export interface Snap {
  /** km along the route of the nearest point */
  km: number
  /** km from the route */
  offKm: number
  point: LngLat
  /** route direction at that point, degrees from north */
  bearing: number
}

const rad = Math.PI / 180

export function bearing(a: LngLat, b: LngLat): number {
  const y = Math.sin((b[0] - a[0]) * rad) * Math.cos(b[1] * rad)
  const x = Math.cos(a[1] * rad) * Math.sin(b[1] * rad) - Math.sin(a[1] * rad) * Math.cos(b[1] * rad) * Math.cos((b[0] - a[0]) * rad)
  return (Math.atan2(y, x) / rad + 360) % 360
}

/** -180..180, + = turn right */
export const turnAngle = (from: number, to: number) => ((to - from + 540) % 360) - 180

export function cumulative(line: LngLat[]): number[] {
  const out = [0]
  for (let i = 1; i < line.length; i++) out.push(out[i - 1] + kmBetween(line[i - 1][1], line[i - 1][0], line[i][1], line[i][0]))
  return out
}

/** Point `km` along the line. */
export function pointAt(line: LngLat[], cum: number[], km: number): LngLat {
  if (line.length === 0) return [0, 0]
  if (km <= 0) return line[0]
  const total = cum[cum.length - 1]
  if (km >= total) return line[line.length - 1]
  let i = 1
  while (i < cum.length - 1 && cum[i] < km) i++
  const seg = cum[i] - cum[i - 1]
  const t = seg === 0 ? 0 : (km - cum[i - 1]) / seg
  return [line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t]
}

function dirOf(angle: number): TurnDir {
  const a = Math.abs(angle)
  const side = angle > 0 ? 'Right' : 'Left'
  if (a >= 150) return 'uturn'
  if (a >= 110) return `sharp${side}` as TurnDir
  if (a >= 50) return side === 'Right' ? 'right' : 'left'
  return `slight${side}` as TurnDir
}

/**
 * Turns from the route shape: the direction 80 m before vs 80 m after each point; changes over 30° count,
 * and close ones (within 120 m) are merged into the sharpest.
 */
export function findTurns(line: LngLat[], cum: number[], minAngle = 30): Turn[] {
  const total = cum[cum.length - 1] ?? 0
  const W = 0.08
  const raw: Turn[] = []
  for (let i = 1; i < line.length - 1; i++) {
    const km = cum[i]
    if (km < W || km > total - W) continue
    const a = turnAngle(bearing(pointAt(line, cum, km - W), line[i]), bearing(line[i], pointAt(line, cum, km + W)))
    if (Math.abs(a) >= minAngle) raw.push({ km, dir: dirOf(a), angle: Math.round(a) })
  }
  const out: Turn[] = []
  for (const t of raw) {
    const last = out[out.length - 1]
    if (last && t.km - last.km < 0.12) {
      if (Math.abs(t.angle) > Math.abs(last.angle)) out[out.length - 1] = t
    } else out.push(t)
  }
  return out
}

export function indexRoute(line: LngLat[]): RouteIndex {
  const cum = cumulative(line)
  return { line, cum, totalKm: cum[cum.length - 1] ?? 0, turns: findTurns(line, cum) }
}

/**
 * Nearest point of the route to `p` (flat-earth projection on each segment — fine at road scale).
 * `hintKm` keeps the match near the last one so a route that comes back past itself does not jump ahead.
 */
export function snap(r: RouteIndex, p: LngLat, hintKm: number | null = null): Snap {
  const { line, cum } = r
  if (line.length < 2) return { km: 0, offKm: line[0] ? kmBetween(p[1], p[0], line[0][1], line[0][0]) : 0, point: line[0] ?? p, bearing: 0 }
  const kx = Math.cos(p[1] * rad)
  let best = { d2: Infinity, km: 0, point: line[0], i: 1 }
  for (let i = 1; i < line.length; i++) {
    if (hintKm !== null && (cum[i] < hintKm - 3 || cum[i - 1] > hintKm + 25)) continue
    const [ax, ay] = [line[i - 1][0] * kx, line[i - 1][1]]
    const [bx, by] = [line[i][0] * kx, line[i][1]]
    const [px, py] = [p[0] * kx, p[1]]
    const dx = bx - ax
    const dy = by - ay
    const len2 = dx * dx + dy * dy
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
    const qx = ax + t * dx
    const qy = ay + t * dy
    const d2 = (px - qx) ** 2 + (py - qy) ** 2
    if (d2 < best.d2) best = { d2, km: cum[i - 1] + t * (cum[i] - cum[i - 1]), point: [qx / kx, qy], i }
  }
  if (best.d2 === Infinity) return snap(r, p, null)
  return {
    km: best.km,
    offKm: kmBetween(p[1], p[0], best.point[1], best.point[0]),
    point: best.point,
    bearing: bearing(line[best.i - 1], line[best.i]),
  }
}

/** The line split at `km`: the part driven and the part ahead. */
export function splitAt(r: RouteIndex, km: number): { done: LngLat[]; ahead: LngLat[] } {
  const at = pointAt(r.line, r.cum, km)
  const i = r.cum.findIndex((c) => c > km)
  if (i === -1) return { done: r.line, ahead: [at] }
  return { done: [...r.line.slice(0, i), at], ahead: [at, ...r.line.slice(i)] }
}

/** Next turns after `km` (within `withinKm`). */
export function turnsAhead(r: RouteIndex, km: number, withinKm = 20, max = 2): Turn[] {
  return r.turns.filter((t) => t.km > km + 0.01 && t.km <= km + withinKm).slice(0, max)
}

/** Minutes for `km` at `kmph` (min 15 km/h so a stop at a signal does not show hours). */
export function minutesFor(km: number, kmph: number): number {
  return Math.round((Math.max(0, km) / Math.max(15, kmph)) * 60)
}

/** Off the route: more than 250 m away (plus the GPS accuracy) for the last 3 fixes. */
export function isOffRoute(lastOffKm: number[], accuracyM = 0): boolean {
  const limit = 0.25 + Math.min(0.5, Math.max(0, accuracyM) / 1000)
  return lastOffKm.length >= 3 && lastOffKm.slice(-3).every((d) => d > limit)
}

/** India: trucks may not go faster than 80 km/h on most highways (60 km/h in many states). */
export const TRUCK_LIMIT_KMPH = 80

/** "400 m" / "1.2 km" / "12 km" */
export function distanceWords(km: number): { value: string; unit: 'm' | 'km' } {
  if (km < 1) return { value: String(Math.max(10, Math.round((km * 1000) / 50) * 50)), unit: 'm' }
  return { value: km < 10 ? km.toFixed(1) : String(Math.round(km)), unit: 'km' }
}
