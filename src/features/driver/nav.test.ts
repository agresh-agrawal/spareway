import { bearing, distanceWords, indexRoute, isOffRoute, minutesFor, snap, splitAt, turnsAhead } from './lib/nav'
import type { LngLat } from '@/lib/geo'

// north 5.5 km, then right (east) 5.2 km, then left (north) again
const line: LngLat[] = [
  [75.0, 22.0],
  [75.0, 22.05],
  [75.05, 22.05],
  [75.05, 22.1],
]

describe('driver navigation', () => {
  const r = indexRoute(line)

  it('finds the right and left turns from the route shape', () => {
    expect(r.turns.map((t) => t.dir)).toEqual(['right', 'left'])
    expect(r.turns[0].km).toBeCloseTo(5.56, 1)
    expect(Math.round(bearing(line[0], line[1]))).toBe(0)
  })

  it('snaps the phone position onto the route and says how far off it is', () => {
    const s = snap(r, [75.001, 22.025])
    expect(s.km).toBeCloseTo(2.78, 1)
    expect(s.offKm).toBeCloseTo(0.1, 1)
    expect(Math.round(s.bearing)).toBe(0)
    const { done, ahead } = splitAt(r, s.km)
    expect(done[done.length - 1]).toEqual(ahead[0])
    expect(turnsAhead(r, s.km)[0]).toMatchObject({ dir: 'right' })
  })

  it('off route only after 3 far fixes; time and distance words', () => {
    expect(isOffRoute([0.4, 0.5])).toBe(false)
    expect(isOffRoute([0.4, 0.5, 0.6])).toBe(true)
    expect(isOffRoute([0.4, 0.5, 0.6], 600)).toBe(false)
    expect(minutesFor(60, 60)).toBe(60)
    expect(minutesFor(1, 0)).toBe(4)
    expect(distanceWords(0.42)).toEqual({ value: '400', unit: 'm' })
    expect(distanceWords(3.26)).toEqual({ value: '3.3', unit: 'km' })
  })
})
