import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { useRealtime } from '@/lib/realtime'
import { deleteCargo, listCargo, saveCargo } from './api'
import type { CargoValues } from './schemas'

/** Cargo lines of a trip, live (loader-added items appear without a refresh). */
export function useCargoItems(tripId: string) {
  useRealtime('cargo_items', [queryKeys.tripCargo(tripId)], `trip_id=eq.${tripId}`, Boolean(tripId))
  return useQuery({ queryKey: queryKeys.tripCargo(tripId), queryFn: () => listCargo(tripId), enabled: Boolean(tripId) })
}

function useInvalidate(tripId: string) {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: queryKeys.tripCargo(tripId) })
    qc.invalidateQueries({ queryKey: queryKeys.trip(tripId) })
    qc.invalidateQueries({ queryKey: queryKeys.tripsAll })
  }
}

export function useSaveCargo(tripId: string) {
  const invalidate = useInvalidate(tripId)
  return useMutation({
    mutationFn: ({ values, id }: { values: CargoValues; id?: string }) => saveCargo(tripId, values, id),
    onSuccess: invalidate,
  })
}

export function useDeleteCargo(tripId: string) {
  const invalidate = useInvalidate(tripId)
  return useMutation({ mutationFn: deleteCargo, onSuccess: invalidate })
}
