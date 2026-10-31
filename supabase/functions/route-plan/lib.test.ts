import { cacheInput, isNoRoute, isQuota, orsBody, parseOrs, parseRequest, simplify } from './lib'

const demo = {
  tripId: 't1',
  coordinates: [
    [76.9366, 28.354],
    [75.8306, 26.7787],
    [72.5947, 22.9536],
    [73.0483, 19.2813],
  ],
  variants: ['fastest', 'shortest', 'no_tolls'],
  truck: { lengthM: 9.75, widthM: 2.43, heightM: 2.43, weightT: 31, axleloadT: 10 },
}

describe('route-plan request', () => {
  it('accepts the Engineering Reference 6.1 example', () => {
    const r = parseRequest(demo)
    expect(r.ok && r.value.variants).toEqual(['fastest', 'shortest', 'no_tolls'])
  })
  it.each([
    [{ ...demo, tripId: '' }],
    [{ ...demo, coordinates: [[76.9, 28.3]] }],
    [{ ...demo, coordinates: [[200, 28], [75, 26]] }],
    [{ ...demo, variants: ['scenic'] }],
    [{ ...demo, truck: { lengthM: 9 } }],
    [null],
  ])('rejects bad input %#', (b) => {
    expect(parseRequest(b).ok).toBe(false)
  })
  it('defaults to all three variants', () => {
    const r = parseRequest({ ...demo, variants: undefined })
    expect(r.ok && r.value.variants).toEqual(['fastest', 'shortest', 'no_tolls'])
  })
})

describe('ORS body', () => {
  const t = demo.truck
  const c = demo.coordinates as [number, number][]
  it('no_tolls avoids tollways; shortest uses the shortest preference', () => {
    expect(orsBody('no_tolls', c, t, true).options).toMatchObject({ avoid_features: ['tollways'] })
    expect(orsBody('shortest', c, t, true).preference).toBe('shortest')
    expect(orsBody('fastest', c, t, true).preference).toBe('fastest')
  })
  it('truck restrictions only when restricted', () => {
    expect(orsBody('fastest', c, t, true).options).toHaveProperty('profile_params.restrictions.weight', 31)
    expect(orsBody('fastest', c, t, false).options).not.toHaveProperty('profile_params')
  })
  it('cache input ignores the trip id and differs per variant', () => {
    expect(cacheInput('fastest', c, t)).toBe(cacheInput('fastest', c, t))
    expect(cacheInput('fastest', c, t)).not.toBe(cacheInput('shortest', c, t))
  })
})

describe('ORS answers', () => {
  it('detects no-route and quota errors', () => {
    expect(isNoRoute(404, {})).toBe(true)
    expect(isNoRoute(400, { error: { code: 2009 } })).toBe(true)
    expect(isNoRoute(500, {})).toBe(false)
    expect(isQuota(429, {})).toBe(true)
    expect(isQuota(403, { error: 'Quota exceeded' })).toBe(true)
  })
  it('parses km, minutes and a simplified line', () => {
    const line = Array.from({ length: 101 }, (_, i) => [76 + i * 0.01, 28])
    const p = parseOrs({ features: [{ properties: { summary: { distance: 1423456, duration: 65940 } }, geometry: { coordinates: line } }] })
    expect(p?.distanceKm).toBe(1423.5)
    expect(p?.durationMin).toBe(1099)
    expect(p?.coordinates).toEqual([
      [76, 28],
      [77, 28],
    ])
    expect(parseOrs({ features: [] })).toBeNull()
  })
  it('simplify keeps a corner', () => {
    const pts: [number, number][] = [
      [0, 0],
      [0.5, 0],
      [1, 0],
      [1, 0.5],
      [1, 1],
    ]
    expect(simplify(pts, 0.001)).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
    ])
  })
})
