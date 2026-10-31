// Challan corner (owner request 4). Pure: what could bring a challan on this trip, and the usual fines.
// Fine amounts are the central Motor Vehicles (Amendment) Act 2019 amounts and the GST e-way bill penalty;
// states can set their own amounts, so the screens say "about".

export type RiskLevel = 'critical' | 'warning' | 'info'

export interface ChallanRisk {
  code: 'OVERLOAD' | 'NEAR_LIMIT' | 'NO_ENTRY' | 'LATE'
  level: RiskLevel
  /** i18n values */
  values: Record<string, string | number>
}

export interface RiskInput {
  cargoKg: number
  payloadKg: number
  warnings: { code: string; city?: string; waitMin?: number; stop?: string }[]
}

/** MV Act s.194(1): ₹20,000 + ₹2,000 for each extra tonne (a part tonne counts as a tonne). */
export function overloadFineInr(cargoKg: number, payloadKg: number): number {
  const extraKg = cargoKg - payloadKg
  if (!(extraKg > 0)) return 0
  return 20_000 + 2_000 * Math.ceil(extraKg / 1000)
}

export function challanRisks(i: RiskInput): ChallanRisk[] {
  const out: ChallanRisk[] = []
  if (i.payloadKg > 0 && i.cargoKg > i.payloadKg) {
    out.push({
      code: 'OVERLOAD',
      level: 'critical',
      values: { extraKg: Math.round(i.cargoKg - i.payloadKg), fine: overloadFineInr(i.cargoKg, i.payloadKg) },
    })
  } else if (i.payloadKg > 0 && i.cargoKg >= 0.95 * i.payloadKg) {
    out.push({ code: 'NEAR_LIMIT', level: 'warning', values: { pct: Math.round((100 * i.cargoKg) / i.payloadKg) } })
  }
  for (const w of i.warnings) {
    if (w.code === 'NO_ENTRY') out.push({ code: 'NO_ENTRY', level: 'warning', values: { city: w.city ?? '', wait: w.waitMin ?? 0 } })
    if (w.code === 'LATE') out.push({ code: 'LATE', level: 'info', values: { stop: w.stop ?? '' } })
  }
  return out
}

/** Papers to carry and the usual fine when one is missing. */
export const PAPERS = [
  { id: 'licence', fineInr: 5_000 }, // s.181
  { id: 'rc', fineInr: 5_000 }, // s.192 (first offence, up to ₹5,000)
  { id: 'insurance', fineInr: 2_000 }, // s.196 (first offence)
  { id: 'puc', fineInr: 10_000 }, // s.190(2)
  { id: 'permit', fineInr: 10_000 }, // s.192A
  { id: 'fitness', fineInr: 5_000 }, // s.192 (first offence, up to ₹5,000)
  { id: 'ewaybill', fineInr: 10_000 }, // CGST s.122/129: ₹10,000 or the tax, whichever is more
] as const

/** Driving habits that bring a challan, with the usual fine. */
export const HABITS = [
  { id: 'speed', fineInr: 2_000 }, // s.183: ₹2,000–4,000 for goods vehicles
  { id: 'seatbelt', fineInr: 1_000 }, // s.194B
  { id: 'phone', fineInr: 5_000 }, // s.184 (first offence, up to ₹5,000)
  { id: 'redlight', fineInr: 5_000 }, // s.184 dangerous driving
] as const

export const COST_KINDS = ['challan', 'breakdown', 'police', 'parking', 'loading', 'other'] as const
export type CostKind = (typeof COST_KINDS)[number]
