// Trip step "Extra loads" (Design System 7.13): three tiles, route strip, load cards sorted by profit with one
// lime "Add to trip" (the best one), collapsed "Not suitable (n)" with plain reasons.
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  ChevronDown,
  ClipboardPen,
  Coins,
  Info,
  MoveHorizontal,
  PackageSearch,
  Scale,
  XCircle,
} from 'lucide-react'
import { EmptyState, ErrorState, PlainButton, Skeleton } from '@/components/common'
import { formatFt, formatInr, formatWeight } from '@/lib/format'
import { useLang } from '@/lib/i18n'
import { toAppError } from '@/lib/errors'
import { cn } from '@/lib/cn'
import { useAddToTrip, useExtraLoads, tripLine } from '../hooks'
import type { Candidate } from '../lib/candidates'
import { reasonText } from '../lib/text'
import { LoadCard } from './LoadCard'
import { RouteStrip } from './RouteStrip'
import { PreviewSheet } from './PreviewSheet'
import { ChecksRow, DecisionChip, SafetyNote, evaluationFix, evaluationReason } from './DecisionBlock'
import { CounterOfferSheet } from '@/features/provider'
import { TypedLoadSheet, TypedResultCard, type CheckedLoad } from './TypedLoad'

/** Compact tile (3 per row also at 375 px in Hindi): icon, number, one-line label. */
function Tile({
  icon: Icon,
  value,
  label,
  ok,
}: {
  icon: typeof Coins
  value: string
  label: string
  ok?: boolean
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-tile border border-line bg-surface-2 p-3 sm:p-4">
      <Icon size={24} aria-hidden className={ok ? 'text-ok' : 'text-ink-2'} />
      <span
        className={cn(
          'text-[18px] leading-7 font-semibold break-words tabular sm:text-[24px]',
          ok && 'text-ok',
        )}
      >
        {value}
      </span>
      <span className="text-label text-ink-2">{label}</span>
    </div>
  )
}

export function ExtraLoadsStep({ tripId }: { tripId: string }) {
  const { t, td } = useLang('extra-loads')
  const x = useExtraLoads(tripId)
  const add = useAddToTrip(tripId)
  const [selected, setSelected] = useState<string | undefined>()
  const [preview, setPreview] = useState<Candidate | null>(null)
  const [showRest, setShowRest] = useState(false)
  const [typing, setTyping] = useState(false)
  const [checked, setChecked] = useState<CheckedLoad[]>([])
  const [counter, setCounter] = useState<Candidate | null>(null)
  const cards = useRef(new Map<string, HTMLElement>())

  if (x.status === 'error') return <ErrorState error={x.error} onRetry={x.retry} />
  if (x.status === 'loading' || !x.data)
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    )

  const d = x.data
  const canAdd = d.trip.status === 'planned' || d.trip.status === 'loading'
  const top = x.recommended[0]
  const usedLength = d.activePlan
    ? Number((d.activePlan.metrics as { usedLengthCm?: number }).usedLengthCm ?? 0)
    : Math.max(0, ...(x.base?.placements ?? []).map((p) => p.x + p.l))
  const freeFloor = Math.max(0, Number(d.truck.internal_length_cm) - usedLength)
  const { line } = tripLine(d)

  const select = (id: string) => {
    setSelected(id)
    cards.current.get(id)?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
  }
  const onAdd = async (c: Candidate) => {
    try {
      const r = await add.mutateAsync(c)
      toast.success(t('added', { code: c.code, before: Math.round(r.before), after: Math.round(r.after) }))
      if (d.trip.selected_route_id) toast(t('addedRoute'))
    } catch (err) {
      const code = toAppError(err).code
      toast.error(t(`common:errors.${code}`))
      if (code === 'LISTING_NOT_OPEN' || code === 'ALREADY_ACCEPTED') x.retry()
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Tile icon={MoveHorizontal} value={formatFt(freeFloor)} label={t('tiles.freeFloor')} />
        <Tile
          icon={Scale}
          value={formatWeight(Math.max(0, x.remainingPayloadKg))}
          label={t('tiles.weightLeft')}
        />
        <Tile
          icon={Coins}
          value={top ? formatInr(top.netBenefitInr) : '—'}
          label={t('tiles.possible')}
          ok={Boolean(top)}
        />
      </div>

      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-label text-ink-2">
        <span className="inline-flex items-center gap-1">
          <Info size={16} aria-hidden />
          {x.approximate ? t('approximate') : t('corridor', { km: x.corridorKm })}
        </span>
        {x.status === 'checking' && <span>{t('checking')}</span>}
      </p>

      <RouteStrip line={line} stops={d.stops} loads={x.recommended} selectedId={selected} onSelect={select} />

      <section className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <h2 className="text-section-title font-semibold">{t('typed.title')}</h2>
          <p className="text-ink-2">{t('typed.help')}</p>
        </div>
        <PlainButton icon={ClipboardPen} onClick={() => setTyping(true)} className="shrink-0">
          {t('typed.open')}
        </PlainButton>
      </section>
      {checked.length > 0 && (
        <section aria-label={t('typed.yours')} className="flex flex-col gap-3">
          <h2 className="text-section-title font-semibold">{t('typed.yours')}</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {checked.map((c) => (
              <TypedResultCard
                key={c.load.id}
                c={c}
                onRemove={() => setChecked((list) => list.filter((x) => x !== c))}
              />
            ))}
          </div>
        </section>
      )}

      {x.recommended.length === 0 ? (
        <EmptyState icon={PackageSearch} text={t('empty')} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {x.recommended.map((c) => (
            <LoadCard
              key={c.listingId}
              ref={(el) => {
                if (el) cards.current.set(c.listingId, el)
              }}
              c={c}
              lime={c === top && canAdd}
              selected={c.listingId === selected}
              adding={add.isPending && add.variables?.listingId === c.listingId}
              disabled={!canAdd || add.isPending || x.status === 'checking'}
              onSee={() => setPreview(c)}
              onAdd={() => void onAdd(c)}
            />
          ))}
        </div>
      )}

      {x.recommended.length > 0 && <SafetyNote />}

      {x.notSuitable.length > 0 && (
        <section className="rounded-card border border-line bg-surface">
          <button
            type="button"
            aria-expanded={showRest}
            onClick={() => setShowRest((v) => !v)}
            className="flex min-h-14 w-full items-center gap-3 p-4 text-left font-semibold"
          >
            <XCircle size={20} className="text-ink-2" aria-hidden />
            {t('notSuitable', { count: x.notSuitable.length })}
            <ChevronDown
              size={20}
              aria-hidden
              className={cn('ml-auto text-ink-2 transition-transform duration-200', showRest && 'rotate-180')}
            />
          </button>
          {showRest && (
            <ul className="flex flex-col gap-2 border-t border-line p-4">
              {x.notSuitable.map((c) => (
                <li key={c.listingId} className="rounded-tile border border-line bg-surface-2 p-3">
                  <div className="flex flex-wrap items-center gap-2 font-semibold">
                    <DecisionChip decision={c.decision} />
                    {td(c.listing.goods_type)} · {c.code}
                  </div>
                  <div className="text-label text-ink-2">
                    {t('card.fromTo', { from: td(c.listing.pickup_name), to: td(c.listing.drop_name) })}
                  </div>
                  <div className="mt-1 text-warn">
                    {evaluationReason(c.evaluation, t) || reasonText(c, t, x.remainingPayloadKg)}
                  </div>
                  {evaluationFix(c.evaluation, t) && (
                    <div className="mt-1 font-medium">
                      {t('fixPrefix')} {evaluationFix(c.evaluation, t)}
                    </div>
                  )}
                  {c.evaluation.reason === 'LOW_MARGIN' && c.listing.status === 'open' && (
                    <PlainButton icon={Coins} className="mt-2 h-11" onClick={() => setCounter(c)}>
                      {t('counterNeed', { inr: formatInr(c.evaluation.minViableInr) })}
                    </PlainButton>
                  )}
                  <div className="mt-2">
                    <ChecksRow ev={c.evaluation} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <TypedLoadSheet
        open={typing}
        onOpenChange={setTyping}
        evaluate={x.evaluateTyped}
        onChecked={(c) => setChecked((list) => [c, ...list])}
      />
      {counter && (
        <CounterOfferSheet
          listing={counter.listing}
          needInr={counter.evaluation.minViableInr}
          open
          onOpenChange={(o) => !o && setCounter(null)}
        />
      )}
      <PreviewSheet candidate={preview} base={x.base} options={x.options} onClose={() => setPreview(null)} />
    </div>
  )
}
