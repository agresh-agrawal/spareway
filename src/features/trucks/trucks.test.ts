import { cmToDisplay, displayToCm } from './lib/sizes'
import { TRUCK_PRESETS } from './lib/presets'
import { truckSchema } from './schemas'
import { truckGist } from './lib/gist'

const valid = {
  reg_no: 'mp09  hg 4821',
  model: 'Tata Signa 3118.T',
  body_type: 'container' as const,
  internal_length_cm: 975,
  internal_width_cm: 243,
  internal_height_cm: 243,
  payload_kg: 15000,
  axles: 3,
  mileage_kmpl: 3.6,
  cost_per_km_inr: 34,
  status: 'active' as const,
}

describe('truck sizes ft ⇄ cm', () => {
  it('shows cm as ft with 2 decimals and back', () => {
    expect(cmToDisplay(975, 'ft')).toBe('31.99')
    expect(displayToCm('32', 'ft')).toBe(975)
    expect(displayToCm('8', 'ft')).toBe(244)
    expect(cmToDisplay(243, 'cm')).toBe('243')
    expect(displayToCm('', 'ft')).toBeNaN()
  })

  it('round trip keeps whole cm within 1 cm', () => {
    for (const cm of [183, 213, 243, 244, 427, 610, 732, 975]) {
      expect(Math.abs(displayToCm(cmToDisplay(cm, 'ft'), 'ft') - cm)).toBeLessThanOrEqual(1)
      expect(displayToCm(cmToDisplay(cm, 'cm'), 'cm')).toBe(cm)
    }
  })

  it('the 32 ft MXL preset is the demo truck size', () => {
    const mxl = TRUCK_PRESETS.find((p) => p.id === '32mxl')!
    expect([mxl.lengthCm, mxl.widthCm, mxl.heightCm, mxl.payloadKg]).toEqual([975, 243, 243, 15000])
  })
})

describe('truck schema', () => {
  it('accepts the demo truck and tidies the number', () => {
    const r = truckSchema.safeParse(valid)
    expect(r.success && r.data.reg_no).toBe('MP09 HG 4821')
  })
  it.each([
    ['internal_length_cm', 50],
    ['internal_width_cm', 400],
    ['payload_kg', 100],
    ['axles', 9],
    ['mileage_kmpl', 0],
    ['reg_no', 'ab'],
  ])('rejects %s = %s', (k, v) => {
    expect(truckSchema.safeParse({ ...valid, [k]: v }).success).toBe(false)
  })
  it('rejects an empty size (NaN)', () => {
    expect(truckSchema.safeParse({ ...valid, internal_height_cm: Number.NaN }).success).toBe(false)
  })
})

describe('truck form summary', () => {
  it('works out the 32 ft MXL truck', () => {
    const g = truckGist({ lengthCm: 975, widthCm: 243, heightCm: 243, payloadKg: 15000, mileageKmpl: 3.6, costPerKmInr: 34, dieselInrPerL: 90 })!
    expect(g.volumeM3).toBe(57.6)
    expect(g.volumeCft).toBe(2033)
    expect(g.pallets).toBe(24) // 8 × 3 with the pallets turned
    expect(g.cartons).toBe(16 * 6 * 6)
    expect(g.densityKgPerM3).toBe(261)
    expect(g.cost500Inr).toBe(17000)
    expect(g.diesel500L).toBe(139)
    expect(g.perTonneKmInr).toBe(2.27)
  })
  it('waits for the inside size', () => {
    expect(truckGist({ lengthCm: Number.NaN, widthCm: 243, heightCm: 243, payloadKg: 0, mileageKmpl: 4, costPerKmInr: 30, dieselInrPerL: 90 })).toBeNull()
  })
})
