import { useEffect, useMemo, useState } from 'react'
import { BadgeCheck, History } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState, ErrorState, MainButton, Sheet, SkeletonList } from '@/components/common'
import type { TripStop } from '@/features/trips'
import { useLang } from '@/lib/i18n'
import { toAppError } from '@/lib/errors'
import { formatDayTime } from '@/lib/format'
import type { CargoChange, CargoItem } from '../api'
import { useCargoChanges, useConfirmCheck } from '../hooks'
import { cargoErrorKey } from './IntegrityNotes'

/** Owner says why a flagged line is right (confirm_cargo_check). The reason is kept in the change history. */
export function ConfirmCheckSheet({
  tripId,
  item,
  onOpenChange,
}: {
  tripId: string
  item: CargoItem | null
  onOpenChange: (o: boolean) => void
}) {
  const { t, td } = useLang('cargo')
  const confirm = useConfirmCheck(tripId)
  const [note, setNote] = useState('')
  const [tried, setTried] = useState(false)
  useEffect(() => {
    if (item) {
      setNote('')
      setTried(false)
    }
  }, [item])
  const short = note.trim().length < 10

  const save = async () => {
    setTried(true)
    if (!item || short) return
    try {
      await confirm.mutateAsync({ id: item.id, note })
      toast.success(t('integrity.confirmed'))
      onOpenChange(false)
    } catch (e) {
      toast.error(t(cargoErrorKey(toAppError(e))))
    }
  }

  return (
    <Sheet
      open={item !== null}
      onOpenChange={onOpenChange}
      dirty={note.trim().length > 0}
      title={t('integrity.confirmTitle', { label: item ? td(item.label) : '' })}
      footer={
        <MainButton icon={BadgeCheck} onClick={save} loading={confirm.isPending} className="w-full">
          {t('integrity.confirm')}
        </MainButton>
      }
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-label font-medium text-ink-2">{t('integrity.reason')}</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={300}
          aria-invalid={tried && short ? true : undefined}
          className="rounded-control border border-line-strong bg-surface-2 p-3 text-[17px] focus:border-accent focus:outline-none"
        />
        <span className={tried && short ? 'text-label text-crit' : 'text-label text-ink-3'}>
          {tried && short ? t('integrity.reasonShort') : t('integrity.reasonHelp')}
        </span>
      </label>
    </Sheet>
  )
}

function valueText(field: string, v: unknown, stops: TripStop[], td: (s: string) => string): string {
  if (v === null || v === undefined || v === '') return '—'
  if (field === 'drop_stop_id') {
    const s = stops.find((x) => x.id === v)
    return s ? `${s.seq} ${td(s.name)}` : '—'
  }
  if (field === 'evidence_path') return '✓'
  if (typeof v === 'boolean') return v ? '✓' : '✗'
  if (field === 'weight_kg') return `${v} kg`
  if (field.endsWith('_cm')) return `${v} cm`
  return typeof v === 'string' ? td(v) : String(v)
}

function ChangeRow({ c, stops }: { c: CargoChange; stops: TripStop[] }) {
  const { t, td, lang } = useLang('cargo')
  const diff = Object.entries((c.changes ?? {}) as Record<string, [unknown, unknown]>)
  return (
    <li className="flex flex-col gap-1 py-3">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-semibold">
          {t(`integrity.actors.${c.actor}`)} {t(`integrity.actions.${c.action}`)} {td(c.label)}
        </span>
        <span className="text-label text-ink-3 tabular">{formatDayTime(c.created_at, lang)}</span>
      </div>
      {c.action === 'update' &&
        diff.map(([f, [a, b]]) => (
          <span key={f} className="text-label text-ink-2 tabular">
            {t(`integrity.fields.${f}`, { defaultValue: f })}: {valueText(f, a, stops, td)} →{' '}
            {valueText(f, b, stops, td)}
          </span>
        ))}
    </li>
  )
}

/** Append-only history of the trip's cargo (cargo_changes), optionally for one line. */
export function CargoHistorySheet({
  tripId,
  open,
  onOpenChange,
  stops,
  itemId,
}: {
  tripId: string
  open: boolean
  onOpenChange: (o: boolean) => void
  stops: TripStop[]
  itemId?: string
}) {
  const { t } = useLang('cargo')
  const changes = useCargoChanges(tripId, open)
  const rows = useMemo(
    () => (changes.data ?? []).filter((c) => !itemId || c.cargo_item_id === itemId),
    [changes.data, itemId],
  )
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t('integrity.history')}>
      {changes.isLoading ? (
        <SkeletonList rows={3} />
      ) : changes.error ? (
        <ErrorState error={changes.error} onRetry={() => changes.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState icon={History} text={t('integrity.historyEmpty')} />
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {rows.map((c) => (
            <ChangeRow key={c.id} c={c} stops={stops} />
          ))}
        </ul>
      )}
    </Sheet>
  )
}
