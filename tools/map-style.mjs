// Builds public/map/spareway-dark.json and spareway-lite.json from an OpenFreeMap base style with the
// Design System 8 map colours. Re-run if the base style changes:
//   node tools/map-style.mjs [baseStyleUrl]     (default https://tiles.openfreemap.org/styles/dark;
//                                                fallbacks: …/styles/positron, …/styles/liberty)
// Behind a proxy (cloud session): NODE_USE_ENV_PROXY=1 node tools/map-style.mjs
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const BASE = process.argv[2] ?? 'https://tiles.openfreemap.org/styles/dark'
const OUT = fileURLToPath(new URL('../public/map/', import.meta.url))

// Design System 8
const C = {
  background: '#0b0d0f',
  land: '#111315',
  water: '#0d1b22',
  roadMinor: '#1d2024',
  roadMajor: '#2a2e33',
  highway: '#3b3f45',
  casing: '#16181b',
  label: '#8a8f98',
  halo: '#0a0a0b',
  building: '#0f1113',
  boundary: '#3b3f45',
}

const ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> <a href="https://www.openmaptiles.org/" target="_blank">© OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'

// labels in Latin script: MapLibre can't shape Devanagari without a plugin
const NAME = ['coalesce', ['get', 'name_en'], ['get', 'name:latin'], ['get', 'name']]

const CITY_SIZE = { place_city_large: 15, place_city: 13, place_town: 12 }

/** Recolour one layer of the base style; returns null to drop it. */
function darkLayer(layer) {
  const l = structuredClone(layer)
  const p = (l.paint ??= {})
  const id = l.id
  if (l.type === 'background') p['background-color'] = C.background
  else if (id.startsWith('water') && l.type === 'fill') p['fill-color'] = C.water
  else if (id === 'waterway') p['line-color'] = C.water
  else if (id.startsWith('landcover') || id.startsWith('landuse')) p['fill-color'] = C.land
  else if (id === 'building') {
    p['fill-color'] = C.building
    p['fill-outline-color'] = C.casing
  } else if (id.startsWith('aeroway')) {
    if (l.type === 'fill') p['fill-color'] = C.land
    else p['line-color'] = C.roadMinor
  } else if (id.startsWith('road_area') || id === 'road_pier') {
    if (l.type === 'fill') p['fill-color'] = C.background
    else p['line-color'] = C.background
  } else if (id === 'highway_path' || id === 'highway_minor') p['line-color'] = C.roadMinor
  else if (id.endsWith('_casing')) p['line-color'] = C.casing
  else if (id.startsWith('highway_major')) p['line-color'] = C.roadMajor
  else if (id.startsWith('highway_motorway')) p['line-color'] = C.highway
  else if (id.startsWith('railway')) p['line-color'] = id.endsWith('dashline') ? C.background : C.roadMinor
  else if (id.startsWith('boundary')) p['line-color'] = C.boundary

  if (l.type === 'symbol') {
    if (l.layout?.['text-field']) {
      p['text-color'] = C.label
      p['text-halo-color'] = C.halo
      p['text-halo-width'] = 1.2
      p['text-halo-blur'] = 0.5
      if (id.startsWith('place_') || id === 'water_name') l.layout['text-field'] = NAME
      if (l.layout['text-transform']) delete l.layout['text-transform']
      if (CITY_SIZE[id]) l.layout['text-size'] = CITY_SIZE[id]
    }
    // POI labels off (Design System 8)
    if (l['source-layer'] === 'poi') return null
  }
  return l
}

// lite: no buildings, no minor roads, city labels only
const LITE_DROP = [
  /^building/,
  /^highway_minor$/,
  /^highway_path$/,
  /^road_/,
  /^aeroway/,
  /^railway/,
  /^landcover_wood$/,
  /^landuse_/,
  /^water_name$/,
  /^highway_name/,
  /^place_(other|suburb|village|town|state|country)/,
]

function style(base, name, layers) {
  const sources = Object.fromEntries(
    Object.entries(base.sources)
      .filter(([key]) => layers.some((l) => l.source === key))
      .map(([key, src]) => [key, src.type === 'vector' ? { ...src, attribution: ATTRIBUTION } : src]),
  )
  return {
    version: 8,
    name,
    metadata: { 'spareway:base': BASE, 'spareway:generated-by': 'tools/map-style.mjs' },
    sources,
    sprite: base.sprite,
    glyphs: base.glyphs,
    layers,
  }
}

const res = await fetch(BASE)
if (!res.ok) throw new Error(`${BASE} → HTTP ${res.status}`)
const base = await res.json()
const dark = base.layers.map(darkLayer).filter(Boolean)
const lite = dark.filter((l) => !LITE_DROP.some((re) => re.test(l.id)))

await writeFile(`${OUT}spareway-dark.json`, JSON.stringify(style(base, 'Spareway dark', dark), null, 2) + '\n')
await writeFile(`${OUT}spareway-lite.json`, JSON.stringify(style(base, 'Spareway lite', lite), null, 2) + '\n')
console.log(`dark: ${dark.length} layers, lite: ${lite.length} layers → ${OUT}`)
