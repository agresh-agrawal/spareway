// costRoute (Architecture F16): diesel = km ÷ mileage × price; tolls; driver = hours × wage;
// waiting = (no-entry waits + checkpoint delays) × waiting cost. Best = lowest total + value of time.
import type { CostBreakdown } from '@/types/domain'
import type { RoutePlan } from './schedule'

export interface CostSettings {
  diesel_price_inr_per_l: number
  driver_cost_inr_per_h: number
  waiting_cost_inr_per_h: number
  value_of_time_inr_per_h: number
}

export interface CostTruck {
  mileage_kmpl: number | null
}

const DEFAULT_KMPL = 4

export function costRoute(distanceKm: number, plan: RoutePlan, truck: CostTruck, settings: CostSettings): CostBreakdown {
  const kmpl = Number(truck.mileage_kmpl) > 0 ? Number(truck.mileage_kmpl) : DEFAULT_KMPL
  const fuelInr = Math.round((distanceKm / kmpl) * settings.diesel_price_inr_per_l)
  const tollsInr = Math.round(plan.tolls.reduce((a, t) => a + t.rateInr, 0))
  const driverInr = Math.round((plan.totalMin / 60) * settings.driver_cost_inr_per_h)
  const waitingInr = Math.round(((plan.waitMin + plan.checkpointMin) / 60) * settings.waiting_cost_inr_per_h)
  const totalInr = fuelInr + tollsInr + driverInr + waitingInr
  return {
    fuelInr,
    tollsInr,
    driverInr,
    waitingInr,
    totalInr,
    score: Math.round(totalInr + (plan.totalMin / 60) * settings.value_of_time_inr_per_h),
    tollCount: plan.tolls.length,
    checkpointCount: plan.checkpointCount,
  }
}

/** Index of the Best route (lowest score; ties → shorter time → list order), or -1. */
export function bestIndex(items: { cost: CostBreakdown; plan: Pick<RoutePlan, 'totalMin'> }[]): number {
  let best = -1
  items.forEach((x, i) => {
    if (best < 0) return void (best = i)
    const b = items[best]
    if (x.cost.score < b.cost.score || (x.cost.score === b.cost.score && x.plan.totalMin < b.plan.totalMin)) best = i
  })
  return best
}
