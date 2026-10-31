import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { addTripExpense, deleteTripExpense, getChallanTrip, listTripExpenses } from './api'
import type { CostKind } from './lib/risks'

export const expensesKey = (tripId: string) => ['trip', tripId, 'expenses'] as const

export function useTripExpenses(tripId: string) {
  return useQuery({ queryKey: expensesKey(tripId), queryFn: () => listTripExpenses(tripId) })
}

export function useChallanTrip(tripId: string) {
  return useQuery({ queryKey: ['trip', tripId, 'challan'], queryFn: () => getChallanTrip(tripId) })
}

/** Adding or removing a cost changes the trip's net earnings too. */
export function useExpenseMutations(tripId: string) {
  const qc = useQueryClient()
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: expensesKey(tripId) })
    void qc.invalidateQueries({ queryKey: queryKeys.tripFinancials(tripId) })
    void qc.invalidateQueries({ queryKey: ['history'] })
  }
  const add = useMutation({
    mutationFn: (v: { kind: CostKind; amountInr: number; note: string }) => addTripExpense(tripId, v.kind, v.amountInr, v.note),
    onSuccess: refresh,
  })
  const remove = useMutation({ mutationFn: deleteTripExpense, onSuccess: refresh })
  return { add, remove }
}
