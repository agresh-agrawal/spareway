import { buildSeed } from '@/lib/fixtures'
import { cargoTonnes, costPerTonneKm, emptyFloorSavedCm, periodTotals, spaceBeforeAfter, tripEarnings } from '../earnings'

describe('tripEarnings — Engineering Reference 7.8 fixture', () => {
  it('base 62,000; route 40,000; one offer 14,000 with cost 3,550 → 32,450; before 22,000; gain +10,450', () => {
    expect(tripEarnings({ baseFreightInr: 62000, extraRevenueInr: 14000, extraCostInr: 3550, routeCostInr: 40000 })).toEqual({
      netInr: 32450,
      beforeInr: 22000,
      gainInr: 10450,
      hasRoute: true,
    })
  })

  it('no route chosen → costs not known, freight and extras still counted', () => {
    expect(tripEarnings({ baseFreightInr: 62000, extraRevenueInr: 0, extraCostInr: 0, routeCostInr: null })).toMatchObject({ netInr: 62000, hasRoute: false })
  })
})

describe('before → after', () => {
  const seed = buildSeed(new Date('2026-10-31T06:00:00Z'))
  const demo = seed.trips.find((t) => t.code === 'TRP-2026-0031')!
  const truck = seed.trucks.find((t) => t.id === demo.truck_id)!
  const cargo = seed.cargo_items.filter((c) => c.trip_id === demo.id)
  const vol = truck.internal_length_cm * truck.internal_width_cm * truck.internal_height_cm
  const extra = { ...cargo[0], id: 'x', source: 'extra_load', length_cm: 80, width_cm: 60, height_cm: 60, weight_kg: 45, quantity: 18 }

  it('space used: demo 34% → with LD-1045 (18 × 80×60×60) higher', () => {
    expect(spaceBeforeAfter(cargo, vol)).toEqual({ beforePct: 34.4, afterPct: 34.4 })
    const r = spaceBeforeAfter([...cargo, extra], vol)
    expect(r.beforePct).toBe(34.4)
    expect(r.afterPct).toBeCloseTo(34.4 + (18 * 0.288 * 100) / 57.58, 0)
  })

  it('cost per tonne-km and tonnes', () => {
    expect(cargoTonnes(cargo, true)).toBeCloseTo(2.638, 3)
    expect(cargoTonnes([...cargo, extra], false)).toBeCloseTo(2.638, 3)
    expect(cargoTonnes([...cargo, extra], true)).toBeCloseTo(3.448, 3)
    expect(costPerTonneKm(40000, 2.638, 1417)).toBe(10.7)
    expect(costPerTonneKm(43550, 3.448, 1417)).toBe(8.91)
    expect(costPerTonneKm(40000, 0, 1417)).toBeNull()
    expect(costPerTonneKm(40000, 2, 0)).toBeNull()
  })

  it('empty floor saved never negative', () => {
    expect(emptyFloorSavedCm(654, 837)).toBe(183)
    expect(emptyFloorSavedCm(654, 600)).toBe(0)
  })
})

describe('periodTotals', () => {
  it('earned = Σ (revenue − cost), extra-load revenue, average space, days in order, sample flag', () => {
    const t = periodTotals([
      { day: '2026-10-31', utilisation_pct: 60, revenue_inr: 200000, cost_inr: 150000, extra_load_revenue_inr: 10000, is_sample: true },
      { day: '2026-10-30', utilisation_pct: 70, revenue_inr: 180000, cost_inr: 140000, extra_load_revenue_inr: 0, is_sample: true },
    ])
    expect(t).toEqual({
      earnedInr: 90000,
      extraInr: 10000,
      spaceAvgPct: 65,
      days: [
        { day: '2026-10-30', earnedInr: 40000, spacePct: 70 },
        { day: '2026-10-31', earnedInr: 50000, spacePct: 60 },
      ],
      sample: true,
    })
    expect(periodTotals([])).toMatchObject({ earnedInr: 0, extraInr: 0, spaceAvgPct: 0, days: [], sample: false })
  })
})
