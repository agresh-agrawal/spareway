// Earnings maths (Architecture F23, Engineering Reference 7.8). Pure.
// net = base freight + Σ accepted extra offers − route total cost − Σ extra-load costs.

export interface TripMoney {
  baseFreightInr: number
  extraRevenueInr: number
  extraCostInr: number
  /** null = no route chosen yet (costs not known) */
  routeCostInr: number | null
}

export interface TripEarnings {
  netInr: number
  /** what the trip earns without the extra loads */
  beforeInr: number
  /** extra offers − extra costs */
  gainInr: number
  hasRoute: boolean
}

export function tripEarnings(m: TripMoney): TripEarnings {
  const route = m.routeCostInr ?? 0
  const gain = m.extraRevenueInr - m.extraCostInr
  const before = m.baseFreightInr - route
  return { netInr: before + gain, beforeInr: before, gainInr: gain, hasRoute: m.routeCostInr !== null }
}

export interface CargoVolumeRow {
  length_cm: number
  width_cm: number
  height_cm: number
  weight_kg: number
  quantity: number
  source: string
}

const isExtra = (c: Pick<CargoVolumeRow, 'source'>) => c.source === 'extra_load'

/** Booked space used without the extra loads → with them (% of the truck's inside volume). */
export function spaceBeforeAfter(cargo: CargoVolumeRow[], truckVolumeCm3: number): { beforePct: number; afterPct: number } {
  const vol = (rows: CargoVolumeRow[]) => rows.reduce((a, c) => a + Number(c.length_cm) * Number(c.width_cm) * Number(c.height_cm) * Number(c.quantity), 0)
  const pct = (v: number) => (truckVolumeCm3 > 0 ? Math.round((1000 * v) / truckVolumeCm3) / 10 : 0)
  return { beforePct: pct(vol(cargo.filter((c) => !isExtra(c)))), afterPct: pct(vol(cargo)) }
}

export function cargoTonnes(cargo: CargoVolumeRow[], withExtra: boolean): number {
  return cargo.filter((c) => withExtra || !isExtra(c)).reduce((a, c) => a + Number(c.weight_kg) * Number(c.quantity), 0) / 1000
}

/** ₹ per tonne-km, or null when it can't be worked out (no route, no cargo). */
export function costPerTonneKm(costInr: number, tonnes: number, km: number): number | null {
  if (!(tonnes > 0) || !(km > 0) || !Number.isFinite(costInr)) return null
  return Math.round((costInr / (tonnes * km)) * 100) / 100
}

/** Floor that would have travelled empty and now carries extra loads (used length after − before), cm. */
export function emptyFloorSavedCm(usedBeforeCm: number, usedAfterCm: number): number {
  return Math.max(0, Math.round(usedAfterCm - usedBeforeCm))
}

export interface DailyStat {
  day: string
  utilisation_pct: number
  revenue_inr: number
  cost_inr: number
  extra_load_revenue_inr: number
  is_sample: boolean
}

export interface PeriodTotals {
  earnedInr: number
  extraInr: number
  spaceAvgPct: number
  days: { day: string; earnedInr: number; spacePct: number }[]
  sample: boolean
}

/** Fleet totals for the period: earned = Σ (revenue − cost), from extra loads, average space used. */
export function periodTotals(stats: DailyStat[]): PeriodTotals {
  const sorted = [...stats].sort((a, b) => a.day.localeCompare(b.day))
  const earned = sorted.reduce((a, s) => a + Number(s.revenue_inr) - Number(s.cost_inr), 0)
  const extra = sorted.reduce((a, s) => a + Number(s.extra_load_revenue_inr), 0)
  const space = sorted.length ? sorted.reduce((a, s) => a + Number(s.utilisation_pct), 0) / sorted.length : 0
  return {
    earnedInr: Math.round(earned),
    extraInr: Math.round(extra),
    spaceAvgPct: Math.round(space * 10) / 10,
    days: sorted.map((s) => ({ day: s.day, earnedInr: Math.round(Number(s.revenue_inr) - Number(s.cost_inr)), spacePct: Number(s.utilisation_pct) })),
    sample: sorted.some((s) => s.is_sample),
  }
}
