import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { buildPackItems, pack } from '@/features/load-planner'
import { fetchFleetStats, fetchTripEarnings, fetchTripFinancials, fetchTripsDone } from './api'
import { cargoTonnes, costPerTonneKm, emptyFloorSavedCm, periodTotals, spaceBeforeAfter, tripEarnings } from './lib/earnings'

/** Trip step "Earnings": money + before → after (space, empty floor saved, cost per tonne-km). */
export function useTripEarnings(tripId: string) {
  const q = useQuery({ queryKey: queryKeys.tripFinancials(tripId), queryFn: () => fetchTripEarnings(tripId) })
  const d = q.data
  const view = useMemo(() => {
    if (!d) return null
    const f = d.financials
    const hasRoute = Boolean(d.trip.selected_route_id)
    const money = tripEarnings({
      baseFreightInr: Number(f.base_freight_inr),
      extraRevenueInr: Number(f.extra_revenue_inr),
      extraCostInr: Number(f.extra_cost_inr),
      routeCostInr: hasRoute ? Number(f.route_cost_inr) : null,
      miscCostInr: Number(f.misc_cost_inr ?? 0),
    })
    const truckVol = Number(d.truck.internal_length_cm) * Number(d.truck.internal_width_cm) * Number(d.truck.internal_height_cm)
    const space = spaceBeforeAfter(d.cargo, truckVol)
    // used floor length from the packing engine, without and with the extra loads
    const used = (rows: typeof d.cargo) => {
      if (rows.length === 0) return 0
      const { container, items } = buildPackItems(rows, d.stops, d.truck)
      return pack(container, items).metrics.usedLengthCm
    }
    const hasExtra = d.cargo.some((c) => c.source === 'extra_load')
    const usedBefore = used(d.cargo.filter((c) => c.source !== 'extra_load'))
    const usedAfter = hasExtra ? used(d.cargo) : usedBefore
    const km = d.routeKm ?? 0
    return {
      money,
      hasRoute,
      hasExtra,
      extraRevenueInr: Number(f.extra_revenue_inr),
      extraCostInr: Number(f.extra_cost_inr),
      routeCostInr: Number(f.route_cost_inr),
      baseFreightInr: Number(f.base_freight_inr),
      miscCostInr: Number(f.misc_cost_inr ?? 0),
      space,
      floorSavedCm: emptyFloorSavedCm(usedBefore, usedAfter),
      perTonneKm: {
        before: hasRoute ? costPerTonneKm(Number(f.route_cost_inr), cargoTonnes(d.cargo, false), km) : null,
        after: hasRoute ? costPerTonneKm(Number(f.route_cost_inr) + Number(f.extra_cost_inr), cargoTonnes(d.cargo, true), km) : null,
      },
    }
  }, [d])
  return { ...q, data: d, view }
}

export type TripEarningsView = NonNullable<ReturnType<typeof useTripEarnings>['view']>

/** /earnings: fleet totals for 7 or 30 days. */
export function usePeriod(days: number) {
  const q = useQuery({ queryKey: queryKeys.fleetStats(days), queryFn: () => fetchFleetStats(days) })
  const totals = useMemo(() => (q.data ? periodTotals(q.data) : null), [q.data])
  return { ...q, totals }
}

export function useTopTrips() {
  return useQuery({ queryKey: ['tripFinancials', 'all'], queryFn: fetchTripFinancials })
}

export function useTripsDone(days: number) {
  return useQuery({ queryKey: [...queryKeys.tripsAll, 'done', days], queryFn: () => fetchTripsDone(days) })
}
