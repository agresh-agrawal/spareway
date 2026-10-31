import { buildSeed } from '@/lib/fixtures'
import { buildPackItems, pack } from '@/features/load-planner'
import { corridorKm, evaluateCandidates, type EvalInput } from '../candidates'
import { checkSpace } from '../space'
import { NH48_LINE } from '../../__fixtures__/nh48'

const seed = buildSeed(new Date('2026-10-31T06:00:00Z'))
const demo = seed.trips.find((t) => t.code === 'TRP-2026-0031')!
const truck = seed.trucks.find((t) => t.id === demo.truck_id)!
const stops = seed.trip_stops.filter((s) => s.trip_id === demo.id).sort((a, b) => a.seq - b.seq)
const cargo = seed.cargo_items.filter((c) => c.trip_id === demo.id)
const booked = cargo.reduce((a, c) => a + c.weight_kg * c.quantity, 0)

function input(over: Partial<EvalInput> = {}): EvalInput {
  return {
    listings: seed.freight_listings,
    line: NH48_LINE,
    approximate: false,
    stops,
    settings: seed.settings,
    truck,
    remainingPayloadKg: truck.payload_kg - booked,
    ...over,
  }
}

const byCode = (list: ReturnType<typeof evaluateCandidates>, code: string) => list.find((c) => c.code === code)!

describe('evaluateCandidates on the NH48 demo trip', () => {
  const list = evaluateCandidates(input())

  it('rejects the four decoys with the right reasons', () => {
    expect(byCode(list, 'LD-1049').feasibility).toMatchObject({ ok: false, reason: 'OFF_CORRIDOR' })
    expect(byCode(list, 'LD-1050').feasibility).toMatchObject({ ok: false, reason: 'WRONG_DIRECTION' })
    expect(byCode(list, 'LD-1051').feasibility).toMatchObject({ ok: false, reason: 'OVER_PAYLOAD' })
    expect(byCode(list, 'LD-1052').feasibility).toMatchObject({ ok: false, reason: 'LOW_MARGIN' })
    expect(byCode(list, 'LD-1049').feasibility.detail).toMatch(/^\d+ km off your route$/)
    expect(byCode(list, 'LD-1052').feasibility.detail).toMatch(/^Earns only ₹-?\d+ after costs — needs ≥ ₹\d+$/)
  })

  it('recommends at least 3 of LD-1041…1048, incl. LD-1045, sorted by profit', () => {
    const rec = list.filter((c) => c.recommended)
    expect(rec.filter((c) => /^LD-104[1-8]$/.test(c.code)).length).toBeGreaterThanOrEqual(3)
    expect(byCode(list, 'LD-1045').recommended).toBe(true)
    expect(rec.map((c) => c.netBenefitInr)).toEqual([...rec.map((c) => c.netBenefitInr)].sort((a, b) => b - a))
    expect(list.slice(0, rec.length).every((c) => c.recommended)).toBe(true)
    for (const c of rec) {
      expect(c.netBenefitInr).toBeGreaterThanOrEqual(seed.settings.min_margin_inr)
      expect(c.netBenefitInr).toBe(c.listing.offered_rate_inr - c.cost.totalInr)
      expect(c.minViableRateInr).toBe(c.cost.totalInr + seed.settings.min_margin_inr)
    }
  })

  it('LD-1045 Vadodara → Bhiwandi: picked up between Ahmedabad and Mumbai, dropped at Mumbai (reused stop)', () => {
    const c = byCode(list, 'LD-1045')
    expect(c.pickupAfterSeq).toBe(2) // after Ahmedabad (Narol)
    expect(c.dropAfterSeq).toBe(3) // Mumbai (Bhiwandi) is within 2 km → reused
    expect(c.newStops).toBe(1)
    expect(c.unloadOrder).toBe(3)
    expect(c.loadOrder).toBe(2.5)
    expect(c.dropKm).toBeGreaterThan(c.pickupKm)
    expect(c.kg).toBe(18 * 45)
    expect(c.detourKm).toBeGreaterThan(0)
  })

  it('is deterministic, also with listings in another order', () => {
    expect(evaluateCandidates(input())).toEqual(list)
    expect(evaluateCandidates(input({ listings: [...seed.freight_listings].reverse() }))).toEqual(list)
  })

  it('skips loads that are not open; flags approximate lines', () => {
    const taken = seed.freight_listings.map((l) => (l.code === 'LD-1045' ? { ...l, status: 'accepted' } : l))
    expect(evaluateCandidates(input({ listings: taken })).find((c) => c.code === 'LD-1045')).toBeUndefined()
    expect(evaluateCandidates(input({ approximate: true })).every((c) => c.approximate)).toBe(true)
  })

  it('corridor: owner answer 40 km, the old default 20 is read as 40, other settings kept', () => {
    expect(corridorKm(20)).toBe(40)
    expect(corridorKm(15)).toBe(15)
    expect(corridorKm(60)).toBe(60)
    // with a 5 km corridor, the Kishangarh marble load (≈ 8 km off the line) is too far
    const tight = evaluateCandidates(input({ settings: { ...seed.settings, corridor_km: 5 } }))
    expect(byCode(tight, 'LD-1041').feasibility.reason).toBe('OFF_CORRIDOR')
  })

  it('space check result is used: no space → NO_SPACE', () => {
    const space = new Map([[byCode(list, 'LD-1042').listingId, 'NO_SPACE' as const]])
    expect(byCode(evaluateCandidates(input({ space })), 'LD-1042').feasibility.reason).toBe('NO_SPACE')
  })
})

describe('checkSpace with the packed demo plan', () => {
  const { container, items } = buildPackItems(cargo, stops, truck)
  const base = pack(container, items).placements
  const list = evaluateCandidates(input())

  it('LD-1045 auto parts fit around the planned boxes', () => {
    const { check, result } = checkSpace(container, base, items, byCode(list, 'LD-1045'))
    expect(check).toBe('OK')
    expect(result.placements.filter((p) => p.fixed)).toHaveLength(104)
    expect(result.placements).toHaveLength(104 + 18)
  })

  it('a load bigger than the space left does not fit', () => {
    const huge = { ...byCode(list, 'LD-1045'), units: 60, listing: { ...byCode(list, 'LD-1045').listing, length_cm: 200, width_cm: 120, height_cm: 120 } }
    expect(checkSpace(container, base, items, huge).check).not.toBe('OK')
  })
})
