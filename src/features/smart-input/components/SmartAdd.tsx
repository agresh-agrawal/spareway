import { useState } from 'react'
import { Camera, Mic, Pencil } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { PlainButton } from '@/components/common'
import { useLang } from '@/lib/i18n'
import { queryKeys } from '@/lib/queryKeys'
import { cn } from '@/lib/cn'
import { useTripStops } from '@/features/trips'
import type { LoaderJobOk } from '@/types/domain'
import {
  addAsLoader,
  addAsOwner,
  deleteLoaderItem,
  listLoaderItems,
  updateLoaderItem,
  type AiResult,
  type LoaderItem,
  type Source,
  type Who,
} from '../api'
import { toRows, type CheckRow } from '../lib/validate'
import { CameraSheet } from './CameraSheet'
import { CheckItemsSheet, type DropStop } from './CheckItemsSheet'
import { VoiceSheet } from './VoiceSheet'

type Step = null | 'camera' | 'voice' | 'type' | 'check'

/** "Scan with camera" + "Speak" → Check items → onConfirm. Shared by the owner's cargo list and the loader page. */
function SmartAdd({
  who,
  stops,
  big,
  onConfirm,
}: {
  who: Who
  stops: DropStop[]
  big?: boolean
  onConfirm: (rows: CheckRow[], source: Source, scan: AiResult) => Promise<void>
}) {
  const { t } = useLang('smart-input')
  const [step, setStep] = useState<Step>(null)
  const [source, setSource] = useState<Source>('camera')
  const [scan, setScan] = useState<AiResult | null>(null)
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [rows, setRows] = useState<CheckRow[]>([])

  const toCheck = (r: AiResult, src: Source, urls: string[] = []) => {
    setScan(r)
    setSource(src)
    setPhotoUrls(urls)
    setRows(toRows(r.items, stops.length === 1 ? stops[0].id : ''))
    setStep('check')
  }
  const cls = cn(big && 'h-14 text-[18px]')

  return (
    <>
      <PlainButton icon={Camera} className={cls} onClick={() => setStep('camera')}>
        {t('camera')}
      </PlainButton>
      <PlainButton icon={Mic} className={cls} onClick={() => setStep('voice')}>
        {t('speak')}
      </PlainButton>

      <CameraSheet
        open={step === 'camera'}
        onOpenChange={(o) => !o && setStep(null)}
        who={who}
        onResult={(r, urls) => toCheck(r, 'camera', urls)}
        onTypeInstead={() => setStep('type')}
      />
      <VoiceSheet
        open={step === 'voice' || step === 'type'}
        startTyping={step === 'type'}
        onOpenChange={(o) => !o && setStep(null)}
        who={who}
        onResult={(r) => toCheck(r, 'voice')}
      />
      <CheckItemsSheet
        open={step === 'check'}
        onOpenChange={(o) => !o && setStep(null)}
        initial={rows}
        stops={stops}
        photos={photoUrls}
        ai={source === 'camera'}
        onConfirm={(checked) => onConfirm(checked, source, scan ?? { scanId: null, imagePaths: [], items: [], warnings: [] })}
      />
    </>
  )
}

/** Slot cargo.addMethods (owner, signed in). */
export function OwnerSmartAdd({ tripId, onAdded }: { tripId: string; onAdded?: () => void }) {
  const { t } = useLang('smart-input')
  const qc = useQueryClient()
  const stops = useTripStops(tripId)
  const drops: DropStop[] = (stops.data ?? []).filter((s) => s.stop_type !== 'origin').map((s) => ({ id: s.id, seq: s.seq, name: s.name }))
  return (
    <SmartAdd
      who={{ tripId }}
      stops={drops}
      onConfirm={async (rows, source, scan) => {
        const n = await addAsOwner(tripId, rows, source, scan)
        await qc.invalidateQueries({ queryKey: queryKeys.trip(tripId) })
        toast.success(t('check.added', { count: n }))
        onAdded?.()
      }}
    />
  )
}

/** Slot loader.actions (loader page, no login): rows go through loader_add_cargo → owner gets "Loader added cargo".
 * Below: the items this loader added — each can be corrected or removed. */
export function LoaderSmartAdd({ token, job }: { token: string; job: LoaderJobOk }) {
  const { t, td } = useLang('smart-input')
  const qc = useQueryClient()
  const key = ['loaderItems', token]
  const items = useQuery({ queryKey: key, queryFn: () => listLoaderItems(token) })
  const [editing, setEditing] = useState<LoaderItem | null>(null)
  const drops: DropStop[] = job.stops.filter((s) => s.type !== 'origin').map((s) => ({ id: s.id, seq: s.seq, name: s.name }))
  const refresh = () => qc.invalidateQueries({ queryKey: key })
  const stopOf = (id: string) => drops.find((s) => s.id === id)
  const list = items.data ?? []
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <SmartAdd
          who={{ loaderToken: token }}
          stops={drops}
          big
          onConfirm={async (rows, source, scan) => {
            await addAsLoader(token, rows, source, scan)
            toast.success(t('check.loaderAdded'))
            void refresh()
          }}
        />
      </div>
      {list.length > 0 && (
        <section className="rounded-card border border-line bg-surface p-4" aria-label={t('mine.title')}>
          <h2 className="mb-2 text-section-title font-semibold">{t('mine.title')}</h2>
          <ul className="flex flex-col divide-y divide-line">
            {list.map((it) => {
              const s = stopOf(it.dropStopId)
              return (
                <li key={it.id} className="flex items-center gap-3 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {td(it.label)} × {it.quantity}
                    </span>
                    <span className="block text-ink-2 tabular">
                      {it.lengthCm} × {it.widthCm} × {it.heightCm} cm · {it.weightKg} kg{s ? ` · ${s.seq} ${td(s.name)}` : ''}
                    </span>
                  </span>
                  <PlainButton icon={Pencil} onClick={() => setEditing(it)} className="h-12 px-3">
                    {t('mine.edit')}
                  </PlainButton>
                </li>
              )
            })}
          </ul>
        </section>
      )}
      <CheckItemsSheet
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        initial={editing ? toRows([{ ...editing, notes: '', confidence: editing.confidence ?? 1 }], editing.dropStopId) : []}
        stops={drops}
        ai={false}
        confirmLabel={t('mine.save')}
        onRemove={
          editing
            ? async () => {
                await deleteLoaderItem(token, editing.id)
                toast.success(t('mine.removed'))
                setEditing(null)
                void refresh()
              }
            : undefined
        }
        onConfirm={async (rows) => {
          if (!editing || !rows[0]) return
          await updateLoaderItem(token, editing.id, rows[0])
          toast.success(t('mine.saved'))
          void refresh()
        }}
      />
    </div>
  )
}
