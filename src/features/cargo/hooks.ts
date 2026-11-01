import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { useRealtime } from '@/lib/realtime'
import { toast } from 'sonner'
import { shrinkImage } from '@/components/common'
import i18n from '@/i18n/setup'
import { FIXTURE_COMPANY_ID } from '@/lib/fixtures'
import { enqueue, isOfflineError } from '@/features/offline'
import {
  addWeighing,
  attachEvidence,
  confirmCargoCheck,
  deleteCargo,
  listCargo,
  listCargoChanges,
  listPastWeights,
  listWeighings,
  saveCargo,
  uploadEvidence,
  type CargoItem,
  type WeighingInput,
} from './api'
import { integrityDefaults } from './lib/fixtureGuard'
import type { CargoValues } from './schemas'

export const QUEUED_PREFIX = 'queued-'

/** A new line added without internet: shown at once, sent later (offline queue kind "cargo_add"). */
function queuedRow(tripId: string, v: CargoValues): CargoItem {
  return {
    ...v,
    ...integrityDefaults,
    id: `${QUEUED_PREFIX}${crypto.randomUUID()}`,
    company_id: FIXTURE_COMPANY_ID,
    trip_id: tripId,
    sku: '',
    max_top_load_kg: null,
    source: 'manual',
    added_by_loader: false,
    extra_load_id: null,
    image_path: null,
    confidence: null,
    created_at: new Date().toISOString(),
  }
}

/** Cargo lines of a trip, live (loader-added items appear without a refresh). */
export function useCargoItems(tripId: string) {
  useRealtime('cargo_items', [queryKeys.tripCargo(tripId)], `trip_id=eq.${tripId}`, Boolean(tripId))
  return useQuery({
    queryKey: queryKeys.tripCargo(tripId),
    queryFn: () => listCargo(tripId),
    enabled: Boolean(tripId),
  })
}

function useInvalidate(tripId: string) {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: queryKeys.tripCargo(tripId) })
    qc.invalidateQueries({ queryKey: [...queryKeys.tripCargo(tripId), 'changes'] })
    qc.invalidateQueries({ queryKey: queryKeys.trip(tripId) })
    qc.invalidateQueries({ queryKey: queryKeys.tripsAll })
  }
}

export function useSaveCargo(tripId: string) {
  const qc = useQueryClient()
  const invalidate = useInvalidate(tripId)
  return useMutation({
    mutationFn: async ({ values, id }: { values: CargoValues; id?: string }): Promise<CargoItem> => {
      try {
        return await saveCargo(tripId, values, id)
      } catch (e) {
        // no internet: keep a new line on the phone and send it later (edits still need the internet)
        if (id || !isOfflineError(e)) throw e
        enqueue('cargo_add', { tripId, values })
        const row = queuedRow(tripId, values)
        qc.setQueryData<CargoItem[]>(queryKeys.tripCargo(tripId), (old) => [...(old ?? []), row])
        toast(i18n.t('offline:queued'))
        return row
      }
    },
    onSuccess: (row) => {
      if (!row.id.startsWith(QUEUED_PREFIX)) invalidate()
    },
  })
}

export function useDeleteCargo(tripId: string) {
  const invalidate = useInvalidate(tripId)
  return useMutation({ mutationFn: deleteCargo, onSuccess: invalidate })
}

/** The company's earlier weights per label (other trips) — "usually X kg each" and the history check. */
export function usePastWeights(tripId: string) {
  return useQuery({
    queryKey: [...queryKeys.tripCargo(tripId), 'past'],
    queryFn: () => listPastWeights(tripId),
    enabled: Boolean(tripId),
    staleTime: 5 * 60_000,
  })
}

/** Change history of this trip's cargo, newest first. */
export function useCargoChanges(tripId: string, enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.tripCargo(tripId), 'changes'],
    queryFn: () => listCargoChanges(tripId),
    enabled: Boolean(tripId) && enabled,
  })
}

export function useConfirmCheck(tripId: string) {
  const invalidate = useInvalidate(tripId)
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => confirmCargoCheck(id, note),
    onSuccess: invalidate,
  })
}

/** Photo → shrink → upload → attach to the line. */
export function useAttachEvidence(tripId: string) {
  const invalidate = useInvalidate(tripId)
  return useMutation({
    mutationFn: async ({ id, file }: { id: string; file: Blob }) =>
      attachEvidence(id, await uploadEvidence(await shrinkImage(file))),
    onSuccess: invalidate,
  })
}

export function useWeighings(tripId: string) {
  // not in the realtime publication: a slip the driver enters shows up within 30 s (and as a notification)
  return useQuery({
    queryKey: [...queryKeys.tripCargo(tripId), 'weighings'],
    queryFn: () => listWeighings(tripId),
    enabled: Boolean(tripId),
    refetchInterval: 30_000,
  })
}

export function useAddWeighing(tripId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ slip, ...w }: Omit<WeighingInput, 'slipPath'> & { slip: Blob }) =>
      addWeighing(tripId, { ...w, slipPath: await uploadEvidence(await shrinkImage(slip)) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...queryKeys.tripCargo(tripId), 'weighings'] }),
  })
}
