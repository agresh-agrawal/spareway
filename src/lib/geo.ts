export type LngLat = [number, number]

const R_KM = 6371

/** Great-circle distance in km (same formula as SQL km_between). */
export function kmBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLng = (lng2 - lng1) * rad
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2
  return 2 * R_KM * Math.asin(Math.sqrt(a))
}

/** [[minLng, minLat], [maxLng, maxLat]] around points, or null when empty */
export function boundsOf(points: LngLat[]): [LngLat, LngLat] | null {
  if (points.length === 0) return null
  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity
  for (const [lng, lat] of points) {
    minLng = Math.min(minLng, lng)
    minLat = Math.min(minLat, lat)
    maxLng = Math.max(maxLng, lng)
    maxLat = Math.max(maxLat, lat)
  }
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ]
}

/** Stable bbox key for queries: "minLng,minLat,maxLng,maxLat" rounded to 2 decimals */
export function bboxKey(b: [LngLat, LngLat]): string {
  return [b[0][0], b[0][1], b[1][0], b[1][1]].map((v) => v.toFixed(2)).join(',')
}

/** India centre for empty maps */
export const INDIA_CENTER: LngLat = [78.9629, 22.5937]
