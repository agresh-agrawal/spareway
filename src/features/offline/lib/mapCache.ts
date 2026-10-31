// "Save map for offline (NH48)" (Architecture F21): put the OpenFreeMap tiles along the Delhi–Mumbai corridor, the map styles,
// sprites and fonts (Latin + Devanagari) into the cache the service worker serves map requests from (cache "map-tiles").

export const MAP_CACHE = 'map-tiles'
const SAVED_KEY = 'spareway.mapSaved'
const TILEJSON = 'https://tiles.openfreemap.org/planet'
const STYLES = ['/map/spareway-dark.json', '/map/spareway-lite.json', '/map/spareway-light.json', '/map/spareway-light-lite.json']
const GLYPH_RANGES = ['0-255', '256-511', '2304-2559', '8192-8447']

/** NH48 hubs, Delhi → Mumbai (lng, lat). */
export const NH48: [number, number][] = [
  [77.209, 28.614],
  [76.938, 28.354],
  [75.787, 26.912],
  [74.864, 26.588],
  [74.64, 26.45],
  [74.319, 26.1],
  [73.712, 24.585],
  [72.974, 23.599],
  [72.571, 23.023],
  [73.181, 22.307],
  [72.988, 21.705],
  [72.831, 21.17],
  [72.905, 20.372],
  [73.048, 19.281],
  [72.877, 19.076],
]

const BBOX = { west: 72.2, east: 77.8, south: 18.6, north: 29.0 }
const FULL_ZOOMS = [4, 5, 6, 7, 8]
const ROUTE_ZOOMS = [9, 10, 11]

export const tileX = (lng: number, z: number) => Math.floor(((lng + 180) / 360) * 2 ** z)
export function tileY(lat: number, z: number) {
  const r = (lat * Math.PI) / 180
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z)
}

/** z/x/y of every tile to keep: the whole corridor box up to z8, then a 3-tile-wide band along the road up to z11. */
export function corridorTiles(): string[] {
  const out = new Set<string>()
  for (const z of FULL_ZOOMS)
    for (let x = tileX(BBOX.west, z); x <= tileX(BBOX.east, z); x++)
      for (let y = tileY(BBOX.north, z); y <= tileY(BBOX.south, z); y++) out.add(`${z}/${x}/${y}`)
  for (const z of ROUTE_ZOOMS)
    for (let i = 0; i < NH48.length - 1; i++) {
      const [a, b] = [NH48[i], NH48[i + 1]]
      const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.02)) // ~2 km
      for (let s = 0; s <= steps; s++) {
        const lng = a[0] + ((b[0] - a[0]) * s) / steps
        const lat = a[1] + ((b[1] - a[1]) * s) / steps
        const x = tileX(lng, z)
        const y = tileY(lat, z)
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) out.add(`${z}/${x + dx}/${y + dy}`)
      }
    }
  return [...out]
}

interface Style {
  sprite?: string
  glyphs?: string
  layers?: { layout?: { 'text-font'?: string[] } }[]
}

/** Every URL to keep, given the tile template from the tilejson. */
export function mapUrls(template: string, styles: Style[]): string[] {
  const urls = new Set<string>([TILEJSON, ...STYLES])
  for (const t of corridorTiles()) {
    const [z, x, y] = t.split('/')
    urls.add(template.replace('{z}', z).replace('{x}', x).replace('{y}', y))
  }
  for (const st of styles) {
    if (st.sprite) for (const s of ['.json', '.png', '@2x.json', '@2x.png']) urls.add(st.sprite + s)
    const stacks = new Set((st.layers ?? []).flatMap((l) => (l.layout?.['text-font'] ? [l.layout['text-font'].join(',')] : [])))
    if (st.glyphs)
      for (const fs of stacks) for (const r of GLYPH_RANGES) urls.add(st.glyphs.replace('{fontstack}', encodeURIComponent(fs)).replace('{range}', r))
  }
  return [...urls]
}

export interface SavedMap {
  files: number
  bytes: number
  at: string
}

export function readSavedMap(): SavedMap | null {
  try {
    const raw = localStorage.getItem(SAVED_KEY)
    return raw ? (JSON.parse(raw) as SavedMap) : null
  } catch {
    return null
  }
}

export async function saveMap(onProgress: (done: number, total: number) => void, signal?: AbortSignal): Promise<SavedMap> {
  const tj = (await (await fetch(TILEJSON)).json()) as { tiles?: string[] }
  const template = tj.tiles?.[0]
  if (!template) throw new Error('no tiles')
  const styles = (await Promise.all(STYLES.map((u) => fetch(u).then((r) => (r.ok ? r.json() : {})).catch(() => ({}))))) as Style[]
  const urls = mapUrls(template, styles)
  const cache = await caches.open(MAP_CACHE)
  let done = 0
  let bytes = 0
  let failed = 0
  const queue = [...urls]
  const worker = async () => {
    while (queue.length) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      const url = queue.shift()!
      try {
        const res = await fetch(url, { mode: 'cors', signal })
        if (res.ok) {
          bytes += (await res.clone().arrayBuffer()).byteLength
          await cache.put(url, res)
        } else if (res.status !== 404) failed++
      } catch (e) {
        if ((e as Error).name === 'AbortError') throw e
        failed++
      }
      onProgress(++done, urls.length)
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))
  if (failed > urls.length * 0.1) throw new Error('too many failed')
  const saved: SavedMap = { files: urls.length - failed, bytes, at: new Date().toISOString() }
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(saved))
  } catch {
    /* ignore */
  }
  return saved
}

export async function removeMap() {
  await caches.delete(MAP_CACHE)
  try {
    localStorage.removeItem(SAVED_KEY)
  } catch {
    /* ignore */
  }
}
