// "See in truck": the planned boxes faded, the new load solid (fitAdditional on the active plan).
import { Suspense, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Sheet, Skeleton } from '@/components/common'
import { useLang } from '@/lib/i18n'
import { useLowData } from '@/lib/lowData'
import { TopView, SideView, TruckScene, usePacker } from '@/features/load-planner'
import type { PackOptions } from '@/types/domain'
import { listingPackItems, type Candidate } from '../lib/candidates'
import { fitWithLoad, type BasePlan } from '../hooks'

const NEW_LOAD_COLOUR_SEQ = 8

function canWebGL(): boolean {
  try {
    if (/jsdom/i.test(navigator.userAgent)) return false
    const c = document.createElement('canvas')
    return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'))
  } catch {
    return false
  }
}

export function PreviewSheet({
  candidate,
  base,
  options,
  onClose,
}: {
  candidate: Candidate | null
  base: BasePlan | null
  options: PackOptions
  onClose: () => void
}) {
  const { t } = useLang('extra-loads')
  const packer = usePacker()
  const { lowData } = useLowData()
  const webgl = useMemo(() => canWebGL(), [])
  const preview = useQuery({
    queryKey: ['extra-loads', 'preview', candidate?.listingId, base?.started, base?.placements.length],
    enabled: Boolean(candidate && base),
    staleTime: Infinity,
    queryFn: () => fitWithLoad(packer, base!, listingPackItems(candidate!), options),
  })
  // the new load in stop colour 8 (pink — not used by a normal trip), so it stands out from the planned boxes
  const shown = useMemo(() => {
    const prefix = candidate ? `${candidate.listingId}#` : '\u0000'
    return (preview.data?.placements ?? []).map((p) => (p.key.startsWith(prefix) ? { ...p, unloadOrder: NEW_LOAD_COLOUR_SEQ } : p))
  }, [preview.data, candidate])
  const states = useMemo(() => {
    const m = new Map<string, 'waiting'>()
    // the new load solid, everything else faded
    const prefix = candidate ? `${candidate.listingId}#` : '\u0000'
    for (const p of preview.data?.placements ?? []) if (!p.key.startsWith(prefix)) m.set(p.key, 'waiting')
    return m
  }, [preview.data, candidate])
  return (
    <Sheet open={Boolean(candidate)} onOpenChange={(o) => !o && onClose()} title={t('preview.title', { code: candidate?.code ?? '' })} description={t('preview.new')}>
      {!preview.data || !base ? (
        <Skeleton className="h-72" />
      ) : webgl && !lowData ? (
        <Suspense fallback={<Skeleton className="h-72" />}>
          <TruckScene container={base.container} placements={shown} states={states} className="h-72 w-full overflow-hidden rounded-card sm:h-96" />
        </Suspense>
      ) : (
        <div className="flex flex-col gap-3">
          <TopView container={base.container} placements={shown} states={states} />
          <SideView container={base.container} placements={shown} states={states} bare />
        </div>
      )}
    </Sheet>
  )
}
