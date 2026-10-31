import { buildSeed } from '@/lib/fixtures'
import { bookedPct, cargoTotals, fitsTruck } from './lib/totals'
import { cargoSchema } from './schemas'

describe('cargo totals (demo trip TRP-2026-0031)', () => {
  const d = buildSeed()
  const demo = d.trips.find((t) => t.code === 'TRP-2026-0031')!
  const items = d.cargo_items.filter((c) => c.trip_id === demo.id)
  const truck = d.trucks.find((t) => t.id === demo.truck_id)!

  it('104 units, 2,638 kg, ≈ 19.8 m³', () => {
    const t = cargoTotals(items)
    expect(t.units).toBe(104)
    expect(t.kg).toBe(2638)
    expect(Math.round(t.m3 * 10) / 10).toBe(19.8)
  })

  it('bars ≈ 18% weight and 34% space of the truck', () => {
    const p = bookedPct(cargoTotals(items), {
      payloadKg: truck.payload_kg,
      volumeM3: (truck.internal_length_cm * truck.internal_width_cm * truck.internal_height_cm) / 1e6,
    })
    expect(Math.round(p.weightPct)).toBe(18)
    expect(Math.round(p.spacePct)).toBe(34)
  })

  it('every demo item fits the 32 ft truck', () => {
    const box = { lengthCm: 975, widthCm: 243, heightCm: 243 }
    expect(items.every((c) => fitsTruck(c, box))).toBe(true)
  })
})

describe('fitsTruck', () => {
  const box = { lengthCm: 518, widthCm: 213, heightCm: 213 }
  it('turns a box to fit unless it must stay upright', () => {
    const tall = { length_cm: 100, width_cm: 100, height_cm: 300, upright_only: false }
    expect(fitsTruck(tall, box)).toBe(true)
    expect(fitsTruck({ ...tall, upright_only: true }, box)).toBe(false)
  })
  it('too big in every position', () => {
    expect(fitsTruck({ length_cm: 95, width_cm: 260, height_cm: 900, upright_only: false }, box)).toBe(false)
  })
})

describe('cargo schema', () => {
  const valid = {
    label: 'LED TV 43 inch',
    client_name: '',
    length_cm: 105,
    width_cm: 18,
    height_cm: 68,
    weight_kg: 11,
    quantity: 12,
    drop_stop_id: 's2',
    pickup_stop_id: null,
    fragile: true,
    upright_only: true,
    stackable: false,
    priority: 'high' as const,
  }
  it('accepts a normal line', () => expect(cargoSchema.safeParse(valid).success).toBe(true))
  it.each([
    ['label', ''],
    ['length_cm', 0],
    ['quantity', 0],
    ['quantity', 1.5],
    ['weight_kg', Number.NaN],
    ['drop_stop_id', ''],
  ])('rejects %s = %s', (k, v) => expect(cargoSchema.safeParse({ ...valid, [k]: v }).success).toBe(false))
})
