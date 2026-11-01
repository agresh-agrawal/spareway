import { buildSeed } from '@/lib/fixtures'
import {
  cargoConfidence,
  checkCargo,
  defaultTareKg,
  historyWeight,
  isVagueLabel,
  needsEvidence,
  weighStatus,
} from '../integrity'

const truck = { lengthCm: 975, widthCm: 243, heightCm: 243, payloadKg: 15000 }
const box = {
  label: 'Refrigerator 260 L',
  length_cm: 62,
  width_cm: 70,
  height_cm: 165,
  weight_kg: 52,
  quantity: 6,
}

describe('cargo integrity checks', () => {
  it('every sample cargo line and open sample load passes clean', () => {
    const d = buildSeed()
    for (const c of d.cargo_items) {
      const tr = d.trucks.find((t) => t.id === d.trips.find((x) => x.id === c.trip_id)?.truck_id)!
      const r = checkCargo(c, {
        lengthCm: tr.internal_length_cm,
        widthCm: tr.internal_width_cm,
        heightCm: tr.internal_height_cm,
        payloadKg: tr.payload_kg,
      })
      expect(r.blocks, c.label).toEqual([])
      expect(needsEvidence(r.flags), c.label).toBe(false)
    }
    for (const l of d.freight_listings)
      expect(checkCargo({ ...l, label: l.goods_type }).blocks, l.goods_type).toEqual([])
  })

  it('refuses a weight no real goods of that size can have', () => {
    expect(checkCargo({ ...box, weight_kg: 6000 }).blocks).toContain('DENSITY_IMPOSSIBLE_HIGH') // 8,450 kg/m³
    expect(checkCargo({ ...box, weight_kg: 1 }).blocks).toContain('DENSITY_IMPOSSIBLE_LOW') // 1.4 kg/m³
    expect(checkCargo({ ...box, weight_kg: 16000 }, truck).blocks).toContain('UNIT_OVER_PAYLOAD')
  })

  it('asks for proof when the weight is possible but unusual', () => {
    expect(checkCargo({ ...box, weight_kg: 2500 }).flags).toContain('DENSITY_HIGH') // 3,520 kg/m³
    expect(checkCargo({ ...box, weight_kg: 8 }).flags).toContain('DENSITY_LOW') // 11 kg/m³
    expect(needsEvidence(checkCargo({ ...box, weight_kg: 8 }).flags)).toBe(true)
  })

  it('flags lines too big or heavy for the truck', () => {
    expect(checkCargo({ ...box, quantity: 400 }, truck).flags).toEqual(
      expect.arrayContaining(['LINE_OVER_PAYLOAD', 'LINE_OVER_VOLUME']),
    )
    expect(checkCargo({ ...box, length_cm: 1000, upright_only: true }, truck).flags).toContain('NO_FIT')
  })

  it('vague labels say nothing about what is inside', () => {
    for (const l of ['goods', 'Box', 'Misc items', 'माल', 'saman', '12', 'ab', 'Carton 2'])
      expect(isVagueLabel(l), l).toBe(true)
    for (const l of ['LED TV 43 inch', 'Ceiling fan (carton of 4)', 'चावल की बोरी', 'Steel coils'])
      expect(isVagueLabel(l), l).toBe(false)
  })

  it('compares with the usual weight of the same goods in earlier trips', () => {
    const past = [50, 52, 54].map((w) => ({ label: 'refrigerator 260 l', weight_kg: w }))
    expect(historyWeight('Refrigerator 260 L', past)).toBe(52)
    expect(historyWeight('Refrigerator 260 L', past.slice(0, 2))).toBeNull()
    expect(checkCargo({ ...box, weight_kg: 20 }, truck, past).flags).toContain('HISTORY_MISMATCH')
    expect(checkCargo({ ...box, weight_kg: 60 }, truck, past).flags).not.toContain('HISTORY_MISMATCH')
  })

  it('low AI confidence needs a check; typed lines do not', () => {
    expect(checkCargo({ ...box, source: 'camera', confidence: 0.3 }).flags).toContain('LOW_AI_CONFIDENCE')
    expect(checkCargo({ ...box, source: 'manual', confidence: 0.3 }).flags).not.toContain('LOW_AI_CONFIDENCE')
  })

  it('confidence rises with proof and the weighbridge, never reaches 100 %', () => {
    const typed = cargoConfidence({ source: 'manual' })
    expect(cargoConfidence({ source: 'manual', evidence_path: 'x' })).toBeGreaterThan(typed)
    expect(cargoConfidence({ source: 'manual', integrity_flags: ['DENSITY_HIGH'] })).toBeLessThan(typed)
    expect(cargoConfidence({ source: 'manual' }, { status: 'mismatch' })).toBeLessThan(typed)
    expect(
      cargoConfidence(
        { source: 'camera', confidence: 1, image_path: 'p', integrity_confirmed_at: 'now' },
        { status: 'match' },
      ),
    ).toBeLessThan(1)
  })

  it('weighbridge: ±10 % (at least 300 kg) is a match; tare from the truck record', () => {
    expect(weighStatus(2700, 2638).match).toBe(true)
    expect(weighStatus(2900, 2638).match).toBe(true) // 262 kg < 300 kg
    expect(weighStatus(3500, 2638).match).toBe(false)
    expect(defaultTareKg({ gross_weight_kg: 31000, payload_kg: 15000 })).toBe(16000)
    expect(defaultTareKg({ gross_weight_kg: null, payload_kg: 15000 })).toBeNull()
  })
})
