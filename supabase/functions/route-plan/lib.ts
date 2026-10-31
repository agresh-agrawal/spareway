// Pure helpers for the route-plan Edge Function (no Deno APIs, so Vitest can test them).
// Contract: Architecture 9.1 / Engineering Reference 6.1.

export type Variant = 'fastest' | 'shortest' | 'no_tolls'
export const VARIANTS: Variant[] = ['fastest', 'shortest', 'no_tolls']

export interface TruckDims {
  lengthM: number
  widthM: number
  heightM: number
  weightT: number
  axleloadT: number
}

export interface RouteRequest {
  tripId: string
  coordinates: [number, number][]
  variants: Variant[]
  truck: TruckDims
}

export interface RouteOut {
  variant: Variant
  distanceKm: number
  durationMin: number
  geometry: { type: 'LineString'; coordinates: [number, number][] }
  restricted: boolean
  cached: boolean
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Validates the request body. Returns the cleaned request or an error message. */
export function parseRequest(body: unknown): { ok: true; value: RouteRequest } | { ok: false; message: string } {
  const b = body as Partial<RouteRequest> | null
  if (!b || typeof b !== 'object') return { ok: false, message: 'Body must be JSON' }
  if (typeof b.tripId !== 'string' || b.tripId.length < 1) return { ok: false, message: 'tripId is required' }
  const coords = b.coordinates
  if (!Array.isArray(coords) || coords.length < 2 || coords.length > 50) return { ok: false, message: 'coordinates: 2 to 50 points' }
  for (const c of coords) {
    if (!Array.isArray(c) || c.length !== 2 || !isNum(c[0]) || !isNum(c[1]) || Math.abs(c[0]) > 180 || Math.abs(c[1]) > 90)
      return { ok: false, message: 'coordinates must be [lng, lat]' }
  }
  const variants = Array.isArray(b.variants) && b.variants.length ? b.variants : VARIANTS
  if (!variants.every((v) => VARIANTS.includes(v as Variant))) return { ok: false, message: 'unknown variant' }
  const t = b.truck as Partial<TruckDims> | undefined
  if (!t || !['lengthM', 'widthM', 'heightM', 'weightT', 'axleloadT'].every((k) => isNum((t as Record<string, unknown>)[k])))
    return { ok: false, message: 'truck sizes are required' }
  return {
    ok: true,
    value: {
      tripId: b.tripId,
      coordinates: coords as [number, number][],
      variants: [...new Set(variants)] as Variant[],
      truck: t as TruckDims,
    },
  }
}

/** ORS Directions v2 body for one variant (profile driving-hgv, GeoJSON). */
export function orsBody(variant: Variant, coordinates: [number, number][], truck: TruckDims, restricted: boolean) {
  const options: Record<string, unknown> = { vehicle_type: 'hgv' }
  if (variant === 'no_tolls') options.avoid_features = ['tollways']
  if (restricted)
    options.profile_params = {
      restrictions: {
        length: round2(truck.lengthM),
        width: round2(truck.widthM),
        height: round2(truck.heightM),
        weight: round2(truck.weightT),
        axleload: round2(truck.axleloadT),
      },
    }
  return {
    coordinates,
    preference: variant === 'shortest' ? 'shortest' : 'fastest',
    instructions: false,
    options,
  }
}

const round2 = (v: number) => Math.round(v * 100) / 100

/** Stable cache key input: same trip shape + truck + variant → same key (trip id not part of it). */
export function cacheInput(variant: Variant, coordinates: [number, number][], truck: TruckDims): string {
  const c = coordinates.map(([lng, lat]) => [Math.round(lng * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5])
  return JSON.stringify({ v: 1, variant, c, t: [truck.lengthM, truck.widthM, truck.heightM, truck.weightT, truck.axleloadT].map(round2) })
}

/** "No route found" from ORS (code 2009 / 2010) → retry without truck restrictions. */
export function isNoRoute(status: number, payload: unknown): boolean {
  const code = (payload as { error?: { code?: number } } | null)?.error?.code
  return status === 404 || code === 2009 || code === 2010 || code === 2004
}

export function isQuota(status: number, payload: unknown): boolean {
  const msg = JSON.stringify(payload ?? '').toLowerCase()
  return status === 429 || (status === 403 && msg.includes('quota'))
}

/** First feature of an ORS GeoJSON answer → distance, duration, geometry (simplified). */
export function parseOrs(payload: unknown): { distanceKm: number; durationMin: number; coordinates: [number, number][] } | null {
  const f = (payload as { features?: { properties?: { summary?: { distance?: number; duration?: number } }; geometry?: { coordinates?: number[][] } }[] })
    ?.features?.[0]
  const s = f?.properties?.summary
  const coords = f?.geometry?.coordinates
  if (!s || !isNum(s.distance) || !isNum(s.duration) || !Array.isArray(coords) || coords.length < 2) return null
  const line = coords.map((p) => [Math.round(p[0] * 1e5) / 1e5, Math.round(p[1] * 1e5) / 1e5] as [number, number])
  return {
    distanceKm: Math.round((s.distance / 1000) * 10) / 10,
    durationMin: Math.round(s.duration / 60),
    coordinates: simplify(line, 0.0004), // ~40 m: keeps the road shape, cuts ~11,000 points to a few thousand
  }
}

/** Douglas–Peucker in degrees (iterative). Keeps the first and last point. */
export function simplify(points: [number, number][], tolerance: number): [number, number][] {
  if (points.length <= 2) return points
  const keep = new Uint8Array(points.length)
  keep[0] = 1
  keep[points.length - 1] = 1
  const stack: [number, number][] = [[0, points.length - 1]]
  const t2 = tolerance * tolerance
  while (stack.length) {
    const [a, b] = stack.pop()!
    let maxD = 0
    let idx = -1
    for (let i = a + 1; i < b; i++) {
      const d = segDist2(points[i], points[a], points[b])
      if (d > maxD) {
        maxD = d
        idx = i
      }
    }
    if (idx !== -1 && maxD > t2) {
      keep[idx] = 1
      stack.push([a, idx], [idx, b])
    }
  }
  return points.filter((_, i) => keep[i] === 1)
}

function segDist2(p: [number, number], a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = dx * dx + dy * dy
  let t = len === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len
  t = Math.max(0, Math.min(1, t))
  const x = a[0] + t * dx - p[0]
  const y = a[1] + t * dy - p[1]
  return x * x + y * y
}
