// Owner addition: the Additional Cargo Evaluation Engine — the 8 required cases + the F19 decoys.
import { buildSeed } from '@/lib/fixtures'
import { fitAdditional } from '@/features/load-planner'
import { evaluateLoad, fitsInside, loadPackItems, type LoadInput, type TripContext } from '../evaluate'
import { evaluateCandidates } from '../candidates'
import { NH48_LINE } from '../../__fixtures__/nh48'

// a simple trip: A (0) → B (1) → C (2) on a straight line, 32 ft truck, ₹34/km
const A = { lat: 26.0, lng: 76.0 }
const B = { lat: 26.0, lng: 77.0 }
const C = { lat: 26.0, lng: 78.0 }
const settings = { corridor_km: 40, road_factor: 1.25, handling_inr_per_kg: 0.5, waiting_cost_inr_per_h: 300, min_margin_inr: 500 }
function ctx(over: Partial<TripContext> = {}): TripContext {
  return {
    line: [
      [A.lng, A.lat],
      [B.lng, B.lat],
      [C.lng, C.lat],
    ],
    approximate: false,
    stops: [
      { id: 'a', seq: 0, ...A },
      { id: 'b', seq: 1, ...B },
      { id: 'c', seq: 2, ...C },
    ],
    truck: { lengthCm: 975, widthCm: 243, heightCm: 243, payloadKg: 15000, costPerKmInr: 34 },
    existingKg: 13500, // 1,500 kg left
    settings,
    ...over,
  }
}
function load(over: Partial<LoadInput> = {}): LoadInput {
  return {
    id: 'typed-1',
    label: 'Cartons',
    // 10 × 50 kg = 500 kg
    batches: [{ label: 'Cartons', quantity: 10, lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 50 }],
    pickup: { name: 'A', ...A },
    drop: { name: 'B', ...B },
    offerInr: 1000,
    handlingInr: 300, // the only extra cost: pickup and drop are existing stops (no detour)
    waitingInr: 0,
    ...over,
  }
}

describe('evaluateLoad — owner cases', () => {
  it('1 · 1,500 kg left, 500 kg load, offer ₹1,000, extra cost ₹300 → ACCEPT, +₹700', () => {
    const ev = evaluateLoad(load(), ctx(), 'OK')
    expect(ev).toMatchObject({ decision: 'ACCEPT', checks: { payload: 'PASS', space: 'PASS', order: 'PASS' }, kg: 500, extraKm: 0, earningsInr: 700 })
    expect(ev.costs).toEqual({ operatingInr: 0, tollsInr: 0, handlingInr: 300, waitingInr: 0, totalInr: 300 })
  })

  it('2 · 1,000 kg left, 1,200 kg load → REJECT (payload), even with a high offer', () => {
    const heavy = load({ batches: [{ label: 'Bags', quantity: 24, lengthCm: 60, widthCm: 40, heightCm: 30, weightKg: 50 }], offerInr: 1_000_000 })
    const ev = evaluateLoad(heavy, ctx({ existingKg: 14000 }), 'OK')
    expect(ev).toMatchObject({ decision: 'REJECT', reason: 'OVER_PAYLOAD', checks: { payload: 'FAIL' }, kg: 1200 })
  })

  it('3 · fits by weight but not by space → REJECT (space)', () => {
    expect(evaluateLoad(load(), ctx(), 'NO_SPACE')).toMatchObject({ decision: 'REJECT', reason: 'NO_SPACE', checks: { payload: 'PASS', space: 'FAIL' } })
  })

  it('4 · feasible, cost ₹1,300 > offer ₹1,000 → NOT PROFITABLE, −₹300', () => {
    expect(evaluateLoad(load({ handlingInr: 1300 }), ctx(), 'OK')).toMatchObject({ decision: 'NOT_PROFITABLE', reason: 'LOW_MARGIN', earningsInr: -300 })
    // also below the minimum profit (₹500) though still positive
    expect(evaluateLoad(load({ handlingInr: 700 }), ctx(), 'OK')).toMatchObject({ decision: 'NOT_PROFITABLE', earningsInr: 300 })
  })

  it('5 · missing size, no route / stops, missing truck size or unknown placement → NEEDS REVIEW', () => {
    const noSize = load({ batches: [{ label: 'X', quantity: 10, lengthCm: 0, widthCm: 40, heightCm: 40, weightKg: 50 }] })
    expect(evaluateLoad(noSize, ctx(), 'OK')).toMatchObject({ decision: 'NEEDS_REVIEW', reason: 'MISSING_LOAD' })
    expect(evaluateLoad(load(), ctx({ line: [], stops: [] }), 'OK')).toMatchObject({ decision: 'NEEDS_REVIEW', reason: 'MISSING_ROUTE' })
    expect(evaluateLoad(load(), ctx({ truck: { lengthCm: 0, widthCm: 243, heightCm: 243, payloadKg: 15000, costPerKmInr: 34 } }), 'OK')).toMatchObject({
      decision: 'NEEDS_REVIEW',
      reason: 'MISSING_TRUCK',
    })
    expect(evaluateLoad(load({ offerInr: Number.NaN }), ctx(), 'OK')).toMatchObject({ decision: 'NEEDS_REVIEW', reason: 'MISSING_OFFER' })
    // placement could not be established → never PASS
    expect(evaluateLoad(load(), ctx(), undefined)).toMatchObject({ decision: 'NEEDS_REVIEW', reason: 'SPACE_UNKNOWN', checks: { space: 'REVIEW' } })
  })

  it('6 · drop before pickup along the route → REJECT (delivery order)', () => {
    const back = load({ pickup: { name: 'C', ...C }, drop: { name: 'B', ...B } })
    expect(evaluateLoad(back, ctx(), 'OK')).toMatchObject({ decision: 'REJECT', reason: 'WRONG_DIRECTION', checks: { order: 'FAIL' } })
  })

  it('7 · a piece bigger than the inside of the truck → REJECT (space), whatever the packer says', () => {
    const pipe = load({ batches: [{ label: 'Pipe', quantity: 1, lengthCm: 1000, widthCm: 30, heightCm: 30, weightKg: 50 }] })
    expect(evaluateLoad(pipe, ctx(), 'OK')).toMatchObject({ decision: 'REJECT', reason: 'TOO_LARGE', checks: { space: 'FAIL' } })
    expect(fitsInside({ label: 'Tall', quantity: 1, lengthCm: 250, widthCm: 100, heightCm: 100, weightKg: 1, uprightOnly: true }, ctx().truck)).toBe(true)
    expect(fitsInside({ label: 'Tall', quantity: 1, lengthCm: 100, widthCm: 100, heightCm: 250, weightKg: 1, uprightOnly: true }, ctx().truck)).toBe(false)
  })

  it('8 · a batch of 40 = 40 boxes in the fit; several batches per load', () => {
    const l = load({
      batches: [
        { label: 'Cartons', quantity: 40, lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 10 },
        { label: 'Crates', quantity: 2, lengthCm: 120, widthCm: 80, heightCm: 80, weightKg: 40, fragile: true },
      ],
    })
    const ev = evaluateLoad(l, ctx(), 'OK')
    expect(ev).toMatchObject({ units: 42, kg: 480 })
    const items = loadPackItems(l, ev)
    expect(items).toHaveLength(42)
    expect(new Set(items.map((i) => i.key)).size).toBe(42)
    expect(items.filter((i) => i.fragile && !i.stackable)).toHaveLength(2)
    // and they really go through the packer: 42 boxes placed in the empty truck
    const r = fitAdditional({ lengthCm: 975, widthCm: 243, heightCm: 243, payloadKg: 15000 }, [], items)
    expect(r.placements).toHaveLength(42)
  })

  it('costs are only what the load adds: detour × ₹/km + handling + waiting at new stops', () => {
    // pickup 10 km north of the line near B, drop at C (existing stop) → 1 new stop
    const off = load({ pickup: { name: 'P', lat: 26.09, lng: 77.0 }, drop: { name: 'C', ...C }, handlingInr: null, waitingInr: null, offerInr: 20000 })
    const ev = evaluateLoad(off, ctx(), 'OK')
    expect(ev.newStops).toBe(1)
    expect(ev.extraKm).toBeCloseTo(2 * 10 * 1.25 + 3, 0)
    expect(ev.costs.operatingInr).toBe(Math.round(ev.extraKm * 34))
    expect(ev.costs.handlingInr).toBe(250) // 500 kg × ₹0.5
    expect(ev.costs.waitingInr).toBe(150) // 30 min × ₹300/h
    expect(ev.earningsInr).toBe(20000 - ev.costs.totalInr)
    expect(ev.decision).toBe('ACCEPT')
  })

  it('is deterministic', () => {
    expect(evaluateLoad(load(), ctx(), 'OK')).toEqual(evaluateLoad(load(), ctx(), 'OK'))
  })
})

describe('evaluateLoad — F19 decoys on the NH48 demo trip', () => {
  const seed = buildSeed(new Date('2026-10-31T06:00:00Z'))
  const demo = seed.trips.find((t) => t.code === 'TRP-2026-0031')!
  const truck = seed.trucks.find((t) => t.id === demo.truck_id)!
  const stops = seed.trip_stops.filter((s) => s.trip_id === demo.id)
  const cargo = seed.cargo_items.filter((c) => c.trip_id === demo.id)
  const booked = cargo.reduce((a, c) => a + c.weight_kg * c.quantity, 0)

  it('LD-1049 off corridor, LD-1050 wrong way, LD-1051 too heavy → REJECT; LD-1052 → NOT PROFITABLE; ≥ 3 ACCEPT', () => {
    const list = evaluateCandidates({
      listings: seed.freight_listings,
      line: NH48_LINE,
      approximate: false,
      stops,
      settings: seed.settings,
      truck,
      remainingPayloadKg: truck.payload_kg - booked,
    })
    const d = Object.fromEntries(list.map((c) => [c.code, [c.decision, c.evaluation.reason]]))
    expect(d['LD-1049']).toEqual(['REJECT', 'OFF_CORRIDOR'])
    expect(d['LD-1050']).toEqual(['REJECT', 'WRONG_DIRECTION'])
    expect(d['LD-1051']).toEqual(['REJECT', 'OVER_PAYLOAD'])
    expect(d['LD-1052']).toEqual(['NOT_PROFITABLE', 'LOW_MARGIN'])
    expect(list.filter((c) => c.decision === 'ACCEPT' && /^LD-104[1-8]$/.test(c.code)).length).toBeGreaterThanOrEqual(3)
  })
})
