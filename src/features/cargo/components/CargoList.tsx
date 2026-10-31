import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowUpFromLine, Copy, Layers, MoreVertical, Package, Pencil, Plus, Trash2, Wine } from 'lucide-react'
import { toast } from 'sonner'
import {
  Badge,
  Bar,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  MainButton,
  PlainButton,
  SkeletonList,
  StopChip,
} from '@/components/common'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Slot } from '@/app/slots'
import { useAuth } from '@/app/auth/AuthProvider'
import { useTrip, useTripStops, type TripStop } from '@/features/trips'
import { useTruck } from '@/features/trucks'
import { useLang } from '@/lib/i18n'
import { toAppError } from '@/lib/errors'
import { formatCargoSize, formatWeight } from '@/lib/format'
import { ensureOverloadAlert, type CargoItem } from '../api'
import { useCargoItems, useDeleteCargo } from '../hooks'
import { bookedPct, cargoTotals, fitsTruck } from '../lib/totals'
import type { CargoInput } from '../schemas'
import { CargoItemSheet, fromItem } from './CargoItemSheet'

function ItemCard({
  item,
  wontFit,
  onEdit,
  onCopy,
  onDelete,
}: {
  item: CargoItem
  wontFit: boolean
  onEdit: () => void
  onCopy: () => void
  onDelete: () => void
}) {
  const { t, td } = useLang('cargo')
  return (
    <li className="flex items-start gap-3 rounded-tile border border-line bg-surface-2 p-3 sm:p-4">
      <Package size={22} className="mt-0.5 shrink-0 text-ink-2" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{td(item.label)}</div>
        {item.client_name && <div className="text-label text-ink-2">{td(item.client_name)}</div>}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-2 tabular">
          <span>{formatCargoSize(item.length_cm, item.width_cm, item.height_cm)}</span>
          <span>{t('item.each', { kg: formatWeight(item.weight_kg), qty: item.quantity })}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {item.fragile && (
            <span className="inline-flex h-7 items-center gap-1 rounded-full bg-warn/10 px-2 text-label font-medium text-warn">
              <Wine size={14} aria-hidden />
              {t('item.fragile')}
            </span>
          )}
          {item.upright_only && (
            <span className="inline-flex h-7 items-center gap-1 rounded-full bg-surface-3 px-2 text-label font-medium">
              <ArrowUpFromLine size={14} aria-hidden />
              {t('item.upright')}
            </span>
          )}
          {!item.stackable && (
            <span className="inline-flex h-7 items-center gap-1 rounded-full bg-surface-3 px-2 text-label font-medium">
              <Layers size={14} aria-hidden />
              {t('item.noStack')}
            </span>
          )}
          {wontFit && (
            <span className="inline-flex h-7 items-center gap-1 rounded-full bg-crit/10 px-2 text-label font-semibold text-crit">
              <AlertTriangle size={14} aria-hidden />
              {t('item.wontFit')}
            </span>
          )}
          {item.added_by_loader && <Badge kind="loader" />}
          {(item.source === 'camera' || item.source === 'voice') && <Badge kind="ai" />}
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button aria-label={t('item.actions')} className="flex size-12 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-surface-3 hover:text-ink">
            <MoreVertical size={20} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil size={18} className="text-ink-2" />
            {t('item.edit')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onCopy}>
            <Copy size={18} className="text-ink-2" />
            {t('item.copy')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onDelete} className="text-crit">
            <Trash2 size={18} />
            {t('item.delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  )
}

/** Trip step 1 "Cargo" (Architecture F9, Design System 7.6). */
export function CargoList({ tripId }: { tripId: string }) {
  const { t, td } = useLang('cargo')
  const { settings } = useAuth()
  const cargo = useCargoItems(tripId)
  const trip = useTrip(tripId)
  const stops = useTripStops(tripId)
  const truck = useTruck(trip.data?.trip.truck_id)
  const del = useDeleteCargo(tripId)
  const [sheet, setSheet] = useState<{ item?: CargoItem; initial?: CargoInput } | null>(null)
  const [toDelete, setToDelete] = useState<CargoItem | null>(null)

  const items = useMemo(() => cargo.data ?? [], [cargo.data])
  const totals = useMemo(() => cargoTotals(items), [items])
  const tr = truck.data
  const truckBox = tr ? { lengthCm: Number(tr.internal_length_cm), widthCm: Number(tr.internal_width_cm), heightCm: Number(tr.internal_height_cm) } : null
  const payloadKg = tr ? Number(tr.payload_kg) : 0
  const pct = bookedPct(totals, { payloadKg, volumeM3: truckBox ? (truckBox.lengthCm * truckBox.widthCm * truckBox.heightCm) / 1e6 : 0 })

  // one "overload" problem when booked weight goes over the payload (only after a change, not on page open)
  const prevKg = useRef<number | null>(null)
  useEffect(() => {
    if (!tr || !trip.data || cargo.isLoading) return
    const before = prevKg.current
    prevKg.current = totals.kg
    if (before === null || totals.kg <= payloadKg || before === totals.kg) return
    ensureOverloadAlert({ id: tripId, code: trip.data.trip.code, truckId: tr.id }, formatWeight(totals.kg), formatWeight(payloadKg)).catch(() => {})
  }, [totals.kg]) // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => {
    const list = (stops.data ?? []).filter((s) => s.stop_type !== 'origin')
    return list
      .map((s: TripStop) => ({ stop: s, items: items.filter((c) => c.drop_stop_id === s.id) }))
      .filter((g) => g.items.length > 0)
  }, [stops.data, items])

  if (cargo.isLoading || stops.isLoading) return <SkeletonList rows={4} />
  if (cargo.error) return <ErrorState error={cargo.error} onRetry={() => cargo.refetch()} />
  if (stops.error) return <ErrorState error={stops.error} onRetry={() => stops.refetch()} />

  const addButtons = (
    <div className="flex flex-wrap gap-2">
      {/* lime only while the list is empty; afterwards the trip's NextStepCard holds the main button */}
      {items.length === 0 ? (
        <MainButton icon={Plus} onClick={() => setSheet({})}>
          {t('add')}
        </MainButton>
      ) : (
        <PlainButton icon={Plus} onClick={() => setSheet({})}>
          {t('add')}
        </PlainButton>
      )}
      <Slot name="cargo.addMethods" props={{ tripId, onAdded: () => cargo.refetch() }} />
    </div>
  )

  const remove = async () => {
    if (!toDelete) return
    try {
      await del.mutateAsync(toDelete.id)
      toast.success(t('item.deleted'))
      setToDelete(null)
    } catch (e) {
      toast.error(t(`common:errors.${toAppError(e).code}`))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Bar label={t('weightLabel')} pct={pct.weightPct} hint={t('weightBar', { pct: Math.round(pct.weightPct) })} />
          <Bar label={t('spaceLabel')} pct={pct.spacePct} hint={t('spaceBar', { pct: Math.round(pct.spacePct) })} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-ink-2 tabular">
            {t('summary', { units: totals.units, kg: formatWeight(totals.kg) })} · <span className="text-ink-3">{t('bookedHint')}</span>
          </p>
          {addButtons}
        </div>
        {tr && totals.kg > payloadKg && (
          <p role="alert" className="flex items-center gap-2 rounded-tile border border-crit/40 bg-crit/[0.08] p-3 font-medium text-crit">
            <AlertTriangle size={20} aria-hidden />
            {t('overload', { kg: formatWeight(totals.kg), payload: formatWeight(payloadKg) })}
          </p>
        )}
      </Card>

      {items.length === 0 ? (
        <EmptyState icon={Package} text={t('empty')} />
      ) : (
        groups.map((g) => {
          const kg = g.items.reduce((a, c) => a + Number(c.weight_kg) * c.quantity, 0)
          const units = g.items.reduce((a, c) => a + c.quantity, 0)
          return (
            <section key={g.stop.id} aria-label={td(g.stop.name)} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <StopChip seq={g.stop.seq} name={g.stop.name} />
                <span className="text-label text-ink-2 tabular">{t('group', { count: units, kg: formatWeight(kg) })}</span>
              </div>
              <ul className="grid gap-2 lg:grid-cols-2">
                {g.items.map((c) => (
                  <ItemCard
                    key={c.id}
                    item={c}
                    wontFit={truckBox ? !fitsTruck(c, truckBox) : false}
                    onEdit={() => setSheet({ item: c })}
                    onCopy={() => setSheet({ initial: fromItem(c) })}
                    onDelete={() => setToDelete(c)}
                  />
                ))}
              </ul>
            </section>
          )
        })
      )}

      <CargoItemSheet
        open={sheet !== null}
        onOpenChange={(o) => !o && setSheet(null)}
        tripId={tripId}
        stops={stops.data ?? []}
        item={sheet?.item}
        initial={sheet?.initial}
        defaultUnit={settings?.cargo_unit === 'in' ? 'in' : 'cm'}
      />
      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={t('item.deleteTitle', { label: toDelete ? td(toDelete.label) : '' })}
        text={t('item.deleteText')}
        confirmLabel={t('item.delete')}
        confirmIcon={Trash2}
        onConfirm={remove}
        loading={del.isPending}
      />
    </div>
  )
}
