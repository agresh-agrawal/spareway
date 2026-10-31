import { places, searchPlaces } from './lib/places'
import { moveItem, nextAction, unloadOrderForStops } from './lib/stops'
import { wizardSchema } from './schemas'
import { buildSeed } from '@/lib/fixtures'

describe('unloadOrderForStops', () => {
  it('origin 0, then 1, 2, 3 in visiting order', () => {
    const stops = [
      { id: 'c', seq: 3, stop_type: 'drop' },
      { id: 'o', seq: 0, stop_type: 'origin' },
      { id: 'a', seq: 1, stop_type: 'drop' },
      { id: 'b', seq: 2, stop_type: 'pickup' },
    ]
    expect(unloadOrderForStops(stops)).toEqual({ o: 0, a: 1, b: 2, c: 3 })
  })
  it('demo trip: Mumbai (deepest) has the highest number', () => {
    const d = buildSeed()
    const demo = d.trips.find((t) => t.code === 'TRP-2026-0031')!
    const stops = d.trip_stops.filter((s) => s.trip_id === demo.id)
    const order = unloadOrderForStops(stops)
    const by = (name: string) => order[stops.find((s) => s.name === name)!.id]
    expect([by('Manesar warehouse'), by('Jaipur (Sitapura)'), by('Ahmedabad (Narol)'), by('Mumbai (Bhiwandi)')]).toEqual([0, 1, 2, 3])
  })
})

describe('trip helpers', () => {
  it('moveItem moves within bounds only', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c'])
    expect(moveItem(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c'])
    expect(moveItem(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c'])
  })
  it('status button order', () => {
    expect(['planned', 'loading', 'in_transit', 'completed'].map(nextAction)).toEqual(['start_loading', 'leave', 'deliver', null])
  })
  it('hubs include every sample place at the seed coordinates', () => {
    const d = buildSeed()
    for (const s of d.trip_stops) {
      const hub = places.find((p) => p.name === s.name)
      expect(hub, s.name).toBeDefined()
      expect([hub!.lat, hub!.lng]).toEqual([s.lat, s.lng])
    }
    expect(places.length).toBeGreaterThanOrEqual(55)
    expect(searchPlaces('pune').map((p) => p.name)).toEqual(['Pune (Chakan)', 'Pune'])
  })
})

describe('new trip wizard schema', () => {
  const stop = (name: string, stop_type: 'origin' | 'drop') => ({ key: name, name, city: name, lat: 22, lng: 75, stop_type })
  const base = { truckId: 't1', departure: '2026-11-01T06:00', freight: 45000 }
  it('Indore → 2 drops is valid', () => {
    expect(wizardSchema.safeParse({ ...base, stops: [stop('Indore', 'origin'), stop('Nashik', 'drop'), stop('Pune', 'drop')] }).success).toBe(true)
  })
  it('needs a truck, an origin first and at least one drop', () => {
    expect(wizardSchema.safeParse({ ...base, truckId: '', stops: [stop('A', 'origin'), stop('B', 'drop')] }).success).toBe(false)
    expect(wizardSchema.safeParse({ ...base, stops: [stop('A', 'origin')] }).success).toBe(false)
    expect(wizardSchema.safeParse({ ...base, stops: [stop('B', 'drop'), stop('A', 'origin')] }).success).toBe(false)
  })
  it('needs a real departure and freight ≥ 0', () => {
    const stops = [stop('A', 'origin'), stop('B', 'drop')]
    expect(wizardSchema.safeParse({ ...base, stops, departure: '' }).success).toBe(false)
    expect(wizardSchema.safeParse({ ...base, stops, freight: -1 }).success).toBe(false)
  })
})
