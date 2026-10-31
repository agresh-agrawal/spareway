import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { useRealtime } from '@/lib/realtime'
import {
  deleteTruck,
  getTruck,
  listOpenTripsByTruck,
  listTruckTrips,
  listTrucks,
  saveTruck,
  setTruckStatus,
  type Truck,
} from './api'
import type { TruckValues } from './schemas'

export function useTrucks() {
  useRealtime('trucks', [queryKeys.trucks])
  return useQuery({ queryKey: queryKeys.trucks, queryFn: listTrucks })
}

export function useTruck(id: string | undefined) {
  return useQuery({ queryKey: queryKeys.truck(id ?? ''), queryFn: () => getTruck(id!), enabled: Boolean(id) })
}

export function useOpenTripsByTruck() {
  return useQuery({ queryKey: [...queryKeys.tripsAll, 'openByTruck'], queryFn: listOpenTripsByTruck })
}

export function useTruckTrips(truckId: string) {
  return useQuery({ queryKey: [...queryKeys.truck(truckId), 'trips'], queryFn: () => listTruckTrips(truckId) })
}

function useInvalidateTrucks() {
  const qc = useQueryClient()
  return (id?: string) => {
    qc.invalidateQueries({ queryKey: queryKeys.trucks })
    if (id) qc.invalidateQueries({ queryKey: queryKeys.truck(id) })
    qc.invalidateQueries({ queryKey: queryKeys.homeStats })
    qc.invalidateQueries({ queryKey: queryKeys.activity })
  }
}

export function useSaveTruck() {
  const invalidate = useInvalidateTrucks()
  return useMutation({
    mutationFn: ({ values, id }: { values: TruckValues; id?: string }) => saveTruck(values, id),
    onSuccess: (t) => invalidate(t.id),
  })
}

export function useSetTruckStatus() {
  const invalidate = useInvalidateTrucks()
  return useMutation({
    mutationFn: ({ truck, status }: { truck: Truck; status: string }) => setTruckStatus(truck, status),
    onSuccess: (_r, v) => invalidate(v.truck.id),
  })
}

export function useDeleteTruck() {
  const invalidate = useInvalidateTrucks()
  return useMutation({ mutationFn: deleteTruck, onSuccess: () => invalidate() })
}
