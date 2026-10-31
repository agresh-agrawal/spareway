// F12: the dark + lite map styles are valid MapLibre styles with the Design System 8 colours and attribution.
// The validator comes with maplibre-gl (@maplibre/maplibre-gl-style-spec), so no extra package.
import { validateStyleMin, type StyleSpecification } from '@maplibre/maplibre-gl-style-spec'

const files = import.meta.glob<StyleSpecification>('/public/map/*.json', { eager: true, import: 'default' })
const dark = files['/public/map/spareway-dark.json']
const lite = files['/public/map/spareway-lite.json']
const icons = import.meta.glob('/public/map/icons/*.svg', { eager: true, query: '?raw', import: 'default' })

const paint = (s: StyleSpecification, id: string) => (s.layers.find((l) => l.id === id) as { paint?: Record<string, unknown> })?.paint ?? {}

describe('map style', () => {
  it.each([
    ['dark', () => dark],
    ['lite', () => lite],
  ])('%s style is valid and loads tiles, glyphs and sprite from OpenFreeMap', (_name, get) => {
    const style = get()
    expect(style).toBeDefined()
    expect(validateStyleMin(style)).toEqual([])
    expect(style.glyphs).toMatch(/^https:\/\/tiles\.openfreemap\.org\//)
    expect(String(style.sprite)).toMatch(/^https:\/\/tiles\.openfreemap\.org\//)
    const vector = Object.values(style.sources).find((s) => s.type === 'vector') as { url?: string; attribution?: string }
    expect(vector.url).toMatch(/^https:\/\/tiles\.openfreemap\.org\//)
    expect(vector.attribution).toContain('OpenStreetMap')
    expect(paint(style, 'background')['background-color']).toBe('#0b0d0f')
    expect(paint(style, 'water')['fill-color']).toBe('#0d1b22')
    expect(paint(style, 'highway_motorway_inner')['line-color']).toBe('#3b3f45')
    expect(paint(style, 'place_city')['text-color']).toBe('#8a8f98')
    expect(paint(style, 'place_city')['text-halo-color']).toBe('#0a0a0b')
  })

  it('lite has no buildings, no minor roads and only city labels', () => {
    const ids = lite.layers.map((l) => l.id)
    expect(ids).not.toContain('building')
    expect(ids).not.toContain('highway_minor')
    const labels = lite.layers.filter((l) => l.type === 'symbol').map((l) => l.id)
    expect(labels.every((id) => id.startsWith('place_city'))).toBe(true)
    expect(lite.layers.length).toBeLessThan(dark.layers.length)
  })

  it('has every map icon', () => {
    const names = Object.keys(icons).map((p) => p.split('/').pop())
    for (const n of ['truck', 'truck-selected', 'stop-pin', 'toll', 'dhaba', 'parking', 'fuel', 'checkpoint', 'no-entry'])
      expect(names).toContain(`${n}.svg`)
    for (const svg of Object.values(icons)) expect(String(svg)).toMatch(/^<svg [^>]*width="(22|30|34)"/)
  })
})
