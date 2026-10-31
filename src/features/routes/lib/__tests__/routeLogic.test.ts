import { buildSeed } from '@/lib/fixtures'
import { kmBetween } from '@/lib/geo'
import type { GeoLineString } from '@/types/domain'
import { bestIndex, costRoute } from '../cost'
import { firstEntry, makeLine, project, type LngLat } from '../line'
import { noEntryRule, tollRate, waitForWindows, type PoiInput } from '../pois'
import { istMinuteOfDay, planSchedule, type ScheduleStop } from '../schedule'
import { loadFixturePois, parsePoisSql } from '../../fixtures/poisFromSql'
import { fixtureRoutes } from '../../fixtures/routeLines'

const seed = buildSeed(new Date('2026-10-31T06:00:00Z'))
const demo = seed.trips.find((t) => t.code === 'TRP-2026-0031')!
const truck = seed.trucks.find((t) => t.id === demo.truck_id)!
const stops: ScheduleStop[] = seed.trip_stops.filter((s) => s.trip_id === demo.id).sort((a, b) => a.seq - b.seq)
const settings = seed.settings
const DEP = '2026-11-01T00:30:00Z' // 06:00 IST
const coords = stops.map((s) => [s.lng, s.lat] as LngLat)
const routes = fixtureRoutes(coords)
const byVariant = (v: string) => routes.find((r) => r.variant === v)!

let pois: PoiInput[]
beforeAll(async () => {
  pois = await loadFixturePois()
})

const IST = (h: number, m = 0) => h * 60 + m

describe('POIs from the committed SQL', () => {
  it('reads every real POI with its data', () => {
    const count = (k: string) => pois.filter((p) => p.kind === k).length
    expect(count('toll')).toBe(55)
    expect(count('city_entry')).toBe(9)
    expect(count('checkpoint')).toBe(6)
    expect(count('dhaba')).toBe(18)
    const mbvv = pois.find((p) => p.city === 'Mira-Bhayandar Vasai-Virar')!
    expect(noEntryRule(mbvv)).toMatchObject({ windows: [[IST(6), IST(10)], [IST(17), IST(21)]], radiusKm: 15 })
  })

  it("handles quotes ('') inside text", () => {
    const [p] = parsePoisSql("  ('dhaba', 'Raju''s Dhaba', 27.1, 76.2, 'NH48', 'Behror', 'RJ', '{\"a\":1}'::jsonb, 'x', false),")
    expect(p).toMatchObject({ kind: 'dhaba', name: "Raju's Dhaba", lat: 27.1, lng: 76.2, city: 'Behror', data: { a: 1 } })
  })

  it('toll rate by axle count, nearest class when missing', () => {
    const p = { data: { rate_inr: { '2': 685, '3': 750, '4': 1080, '7': 1310 } } } as PoiInput
    expect(tollRate(p, 3)).toBe(750)
    expect(tollRate(p, 2)).toBe(685)
    expect(tollRate(p, 9)).toBe(1310)
    expect(tollRate({ data: {} } as PoiInput, 3)).toBe(0)
  })
})

describe('line geometry', () => {
  it('chainage, projection and first entry into a circle', () => {
    const line = makeLine([
      [76.0, 26.0],
      [77.0, 26.0],
    ])
    expect(line.lengthKm).toBeCloseTo(kmBetween(26, 76, 26, 77), 6)
    const pr = project(line, [76.5, 26.1])
    expect(pr.km).toBeCloseTo(line.lengthKm / 2, 0)
    expect(pr.offKm).toBeCloseTo(11.1, 0)
    const entry = firstEntry(line, [76.8, 26.0], 10)!
    expect(entry).toBeCloseTo(kmBetween(26, 76, 26, 76.8) - 10, 0)
    expect(firstEntry(line, [76.5, 27.0], 10)).toBeNull()
  })
})

describe('no-entry windows', () => {
  it('waits until the window ends, also across adjacent and overnight windows', () => {
    expect(waitForWindows([[IST(17), IST(21)]], IST(18, 40))).toEqual({ waitMin: 140, until: IST(21) })
    expect(waitForWindows([[IST(17), IST(21)]], IST(16, 59)).waitMin).toBe(0)
    expect(waitForWindows([[IST(7), IST(13)], [IST(13), IST(16)]], IST(12)).waitMin).toBe(240)
    expect(waitForWindows([[IST(22), IST(6)]], IST(23))).toEqual({ waitMin: 420, until: IST(6) })
    expect(waitForWindows([[IST(7), IST(24)]], IST(23)).until).toBe(0)
  })

  it('IST minute of the day', () => {
    expect(istMinuteOfDay(Date.parse('2026-11-01T00:30:00Z'))).toBe(IST(6))
    expect(istMinuteOfDay(Date.parse('2026-11-01T18:30:00Z'))).toBe(0)
  })
})

describe('planSchedule on the demo trip', () => {
  it('ETAs in stop order, breaks every ≤ 5 h of driving, overnight rest, tolls and check posts', () => {
    const plan = planSchedule(byVariant('fastest'), stops, pois, settings, DEP, truck.axles)
    const etas = plan.schedule.stopEtas
    expect(etas.map((e) => e.stopId)).toEqual(stops.filter((s) => s.seq > 0).map((s) => s.id))
    expect(etas.map((e) => Date.parse(e.eta))).toEqual([...etas.map((e) => Date.parse(e.eta))].sort((a, b) => a - b))
    const kinds = plan.schedule.halts.map((h) => h.kind)
    expect(kinds).toContain('break')
    expect(kinds).toContain('overnight')
    expect(plan.overnightCount).toBeGreaterThanOrEqual(1)
    // first break by 5 h of driving (+ the few km to the dhaba)
    expect(plan.schedule.halts[0].atMin).toBeLessThanOrEqual(5 * 60 + 10)
    expect(plan.tolls.length).toBeGreaterThanOrEqual(20)
    expect(plan.checkpointCount).toBe(2)
    // driving never faster than the Settings average speed (45 km/h)
    expect(plan.driveMin).toBeGreaterThanOrEqual(Math.round((byVariant('fastest').distanceKm / 45) * 60) - 1)
    expect(plan.totalMin).toBeGreaterThan(plan.driveMin)
  })

  it('no tolls on the no-toll route, fewer on the shortest', () => {
    const fast = planSchedule(byVariant('fastest'), stops, pois, settings, DEP, 3)
    const short = planSchedule(byVariant('shortest'), stops, pois, settings, DEP, 3)
    const free = planSchedule(byVariant('no_tolls'), stops, pois, settings, DEP, 3)
    expect(free.tolls).toEqual([])
    expect(short.tolls.length).toBeLessThan(fast.tolls.length)
    expect(short.checkpointCount).toBe(1)
  })

  it('waits out Mumbai (Mira-Bhayandar) no-entry hours for Bhiwandi; bypassed cities never cause a wait', () => {
    let mumbaiWaits = 0
    for (let h = 0; h < 24; h++) {
      const dep = new Date(Date.parse(DEP) + h * 3_600_000).toISOString()
      const plan = planSchedule(byVariant('fastest'), stops, pois, settings, dep, 3)
      for (const w of plan.schedule.warnings) {
        if (w.code !== 'NO_ENTRY') continue
        expect(['Mira-Bhayandar Vasai-Virar', 'Ahmedabad']).toContain(w.city)
        const rule = noEntryRule(pois.find((p) => p.kind === 'city_entry' && p.city === w.city)!)!
        // arrived inside a window, left when it ended
        expect(rule.windows.some(([a, b]) => w.from >= a && w.from < b)).toBe(true)
        expect(w.waitMin).toBeGreaterThan(0)
        if (w.city.startsWith('Mira')) {
          mumbaiWaits++
          expect(w.stopId).toBe(stops[3].id)
        }
      }
      const waitHalts = plan.schedule.halts.filter((x) => x.kind === 'no_entry_wait')
      expect(plan.waitMin).toBe(waitHalts.reduce((a, x) => a + x.durationMin, 0))
    }
    expect(mumbaiWaits).toBeGreaterThan(0)
  })

  it('is deterministic', () => {
    const a = planSchedule(byVariant('shortest'), stops, pois, settings, DEP, 3)
    const b = planSchedule(byVariant('shortest'), stops, pois, settings, DEP, 3)
    expect(b).toEqual(a)
  })

  it('a stop arriving after its delivery time gets a LATE warning', () => {
    const tight = stops.map((s) => (s.seq === 1 ? { ...s, window_end: '2026-11-01T01:00:00Z' } : s))
    const plan = planSchedule(byVariant('fastest'), tight, pois, settings, DEP, 3)
    expect(plan.schedule.warnings.find((w) => w.code === 'LATE')).toMatchObject({ stopId: stops[1].id })
  })
})

describe('planSchedule on a small line', () => {
  const line: GeoLineString = {
    type: 'LineString',
    coordinates: [
      [76.0, 26.0],
      [77.0, 26.0],
    ],
  }
  const s: ScheduleStop[] = [
    { id: 'o', seq: 0, stop_type: 'origin', name: 'A', city: 'A', lat: 26, lng: 76 },
    { id: 'd', seq: 1, stop_type: 'drop', name: 'Town (Depot)', city: 'Town', lat: 26, lng: 77 },
  ]
  const zone: PoiInput = { id: 'z', kind: 'city_entry', name: 'Town no-entry', city: 'Town', lat: 26, lng: 77, data: { no_entry: [['08:00', '11:00']], radius_km: 10, direction: 'city_entry' } }

  it('waits at the city edge inside the window, then delivers', () => {
    // 100 km at 50 km/h → 2 h; leave 06:30 IST → edge ~08:18 → wait until 11:00
    const plan = planSchedule({ distanceKm: 100, durationMin: 120, geometry: line }, s, [zone], { ...settings, avg_speed_kmph: 50 }, '2026-11-01T01:00:00Z', 2)
    const wait = plan.schedule.halts.find((h) => h.kind === 'no_entry_wait')!
    expect(wait.name).toBe('Town')
    expect(istMinuteOfDay(Date.parse('2026-11-01T01:00:00Z') + (wait.atMin + wait.durationMin) * 60000)).toBe(IST(11))
    expect(plan.waitMin).toBe(wait.durationMin)
    expect(istMinuteOfDay(Date.parse(plan.schedule.stopEtas[0].eta))).toBeGreaterThanOrEqual(IST(11))
  })

  it('no wait outside the window; a corridor rule applies only when it names the stop town', () => {
    const early = planSchedule({ distanceKm: 100, durationMin: 120, geometry: line }, s, [zone], settings, '2026-10-31T23:00:00Z', 2)
    expect(early.waitMin).toBe(0)
    const corridor = { ...zone, data: { no_entry: [['00:00', '24:00']], radius_km: 10, direction: 'Gujarat_to_Town_Kalyan' } }
    expect(planSchedule({ distanceKm: 100, durationMin: 120, geometry: line }, s, [corridor], settings, '2026-11-01T01:00:00Z', 2).waitMin).toBeGreaterThan(0)
    const other = { ...corridor, data: { ...corridor.data, direction: 'Gujarat_to_Elsewhere' } }
    expect(planSchedule({ distanceKm: 100, durationMin: 120, geometry: line }, s, [other], settings, '2026-11-01T01:00:00Z', 2).waitMin).toBe(0)
  })
})

describe('costRoute', () => {
  it('diesel, tolls, driver, waiting and the Best route', () => {
    const plan = { tolls: [{ rateInr: 750 }, { rateInr: 345 }], totalMin: 600, waitMin: 60, checkpointMin: 20, checkpointCount: 1 } as never
    const c = costRoute(360, plan, { mileage_kmpl: 3.6 }, settings)
    expect(c).toEqual({
      fuelInr: 9000, // 360 km ÷ 3.6 × ₹90
      tollsInr: 1095,
      driverInr: 1200, // 10 h × ₹120
      waitingInr: 400, // 80 min × ₹300/h
      totalInr: 11695,
      score: 11695 + 1500, // + 10 h × ₹150
      tollCount: 2,
      checkpointCount: 1,
    })
  })

  it('Best = cheapest after time value, on the demo routes', () => {
    const items = routes.map((r) => {
      const plan = planSchedule(r, stops, pois, settings, DEP, 3)
      return { plan, cost: costRoute(r.distanceKm, plan, truck, settings) }
    })
    const best = bestIndex(items)
    expect(items.every((x) => x.cost.score >= items[best].cost.score)).toBe(true)
    expect(bestIndex([])).toBe(-1)
  })
})
