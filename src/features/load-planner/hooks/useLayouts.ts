import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { fetchPlannableTrips, fetchTruckLayout } from '../api'

/** Trips that can be planned, soonest first ("Plan load" on Home). */
export function usePlannableTrips() {
  return useQuery({ queryKey: [...queryKeys.tripsAll, 'plannable'], queryFn: () => fetchPlannableTrips() })
}

/** The truck's current or next trip and its active plan (truck tab "Load layout"). */
export function useTruckLayout(truckId: string) {
  return useQuery({ queryKey: [...queryKeys.truck(truckId), 'layout'], queryFn: () => fetchTruckLayout(truckId) })
}
