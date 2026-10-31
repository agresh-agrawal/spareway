// Plain reason lines for a load (English / Hindi through the passed translator).
import { formatInr, formatKm, formatWeight } from '@/lib/format'
import type { Candidate } from './candidates'

type T = (key: string, values?: Record<string, unknown>) => string

export function takeText(c: Candidate, t: T): string {
  return t('card.take', { profit: formatInr(c.netBenefitInr), cost: formatInr(c.cost.totalInr), detour: formatKm(c.detourKm) })
}

export function reasonText(c: Candidate, t: T, remainingPayloadKg: number): string {
  const r = c.feasibility.reason
  if (!r) return takeText(c, t)
  return t(`reason.${r}`, {
    km: Math.round(c.offKm),
    kg: formatWeight(c.kg),
    left: formatWeight(Math.max(0, remainingPayloadKg)),
    net: formatInr(c.netBenefitInr),
    need: formatInr(c.minViableRateInr),
  })
}
