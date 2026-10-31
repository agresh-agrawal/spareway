import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { advanceTrip, createTrip, getTrip, getTripStops, listTrips, type NewTrip, type Trip } from './api'

export function useTrips() {
  return useQuery({ queryKey: queryKeys.trips(), queryFn: listTrips })
}

export function useTrip(id: string | undefined) {
  return useQuery({ queryKey: queryKeys.trip(id ?? ''), queryFn: () => getTrip(id!), enabled: Boolean(id) })
}

export function useTripStops(id: string | undefined) {
  return useQuery({ queryKey: queryKeys.tripStops(id ?? ''), queryFn: () => getTripStops(id!), enabled: Boolean(id) })
}

export function useCreateTrip() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: NewTrip) => createTrip(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tripsAll })
      qc.invalidateQueries({ queryKey: queryKeys.activity })
      qc.invalidateQueries({ queryKey: queryKeys.homeStats })
    },
  })
}

export function useAdvanceTrip() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (trip: Trip) => advanceTrip(trip),
    onSuccess: (_r, trip) => {
      qc.invalidateQueries({ queryKey: queryKeys.trip(trip.id) })
      qc.invalidateQueries({ queryKey: queryKeys.tripsAll })
      qc.invalidateQueries({ queryKey: queryKeys.homeStats })
    },
  })
}
