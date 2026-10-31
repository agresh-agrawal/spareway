// Trip step "Earnings" (Design System 7.15): hero "You earn ₹…" + gain from extra loads, three before → after
// tiles, freight − costs = earning, lime "Share on WhatsApp".
import { Link } from 'react-router'
import { Info, MoveHorizontal, PackageCheck, Route, Send, Weight } from 'lucide-react'
import { Badge, Card, CardHeader, ErrorState, Skeleton } from '@/components/common'
import { formatFt, formatInr } from '@/lib/format'
import { useLang } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import { useTripEarnings } from '../hooks'
import { Tile } from './Tile'

const perTk = (v: number | null) => (v === null ? '—' : `₹${v.toFixed(2)}`)

export function EarningsStep({ tripId }: { tripId: string }) {
  const { t } = useLang('analytics')
  const q = useTripEarnings(tripId)
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />
  if (!q.view || !q.data)
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-32" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-48" />
      </div>
    )
  const v = q.view
  const code = q.data.trip.code
  const rows: { label: string; value: string; sign: '+' | '−'; estimated?: boolean }[] = [
    { label: t('list.freight'), value: formatInr(v.baseFreightInr), sign: '+' },
    { label: t('list.extra'), value: formatInr(v.extraRevenueInr), sign: '+' },
    { label: t('list.route'), value: v.hasRoute ? formatInr(v.routeCostInr) : t('list.notKnown'), sign: '−', estimated: v.hasRoute },
    { label: t('list.extraCost'), value: formatInr(v.extraCostInr), sign: '−', estimated: v.extraCostInr > 0 },
  ]
  const shareText = t('shareText', {
    code,
    freight: formatInr(v.baseFreightInr),
    extra: formatInr(v.extraRevenueInr),
    route: v.hasRoute ? formatInr(v.routeCostInr) : t('list.notKnown'),
    extraCost: formatInr(v.extraCostInr),
    net: formatInr(v.money.netInr),
    gain: `${v.money.gainInr >= 0 ? '+' : ''}${formatInr(v.money.gainInr)}`,
  })

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[30px] leading-9 font-semibold tabular sm:text-hero">{t('hero', { inr: formatInr(v.money.netInr) })}</h2>
          {v.hasRoute && <Badge kind="estimated" />}
        </div>
        {v.hasExtra ? (
          <p className="text-[18px] font-semibold text-ok tabular">{t('gain', { inr: formatInr(v.money.gainInr) })}</p>
        ) : (
          <p className="text-ink-2">{t('noExtra')}</p>
        )}
        {!v.hasRoute && (
          <p className="flex flex-wrap items-center gap-2 text-ink-2">
            <Info size={18} aria-hidden />
            {t('noRoute')}
            <Link to={`/trips/${tripId}?step=route`} className="inline-flex h-10 items-center gap-1.5 rounded-control border border-line-strong bg-surface-2 px-3 font-semibold text-ink hover:bg-surface-3">
              <Route size={18} aria-hidden />
              {t('openRoute')}
            </Link>
          </p>
        )}
      </Card>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Tile icon={PackageCheck} value={t('tiles.spaceValue', { before: Math.round(v.space.beforePct), after: Math.round(v.space.afterPct) })} label={t('tiles.space')} tone={v.hasExtra ? 'ok' : undefined} />
        <Tile icon={MoveHorizontal} value={formatFt(v.floorSavedCm)} label={t('tiles.floor')} tone={v.floorSavedCm > 0 ? 'ok' : undefined} />
        <Tile icon={Weight} value={t('tiles.perTonneKmValue', { before: perTk(v.perTonneKm.before), after: perTk(v.perTonneKm.after) })} label={t('tiles.perTonneKm')} />
      </div>

      <Card>
        <CardHeader icon={Info} title={t('list.title')} />
        <dl className="flex flex-col tabular">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-3 border-b border-line py-3">
              <dt className="flex flex-wrap items-center gap-2 text-ink-2">
                <span className="w-4 text-center font-semibold text-ink">{r.sign}</span>
                {r.label}
                {r.estimated && <Badge kind="estimated" />}
              </dt>
              <dd className="font-medium">{r.value}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 pt-3">
            <dt className="flex items-center gap-2 font-semibold">
              <span className="w-4 text-center">=</span>
              {t('list.total')}
            </dt>
            <dd className={cn('text-[20px] font-semibold', v.money.netInr >= 0 ? 'text-ok' : 'text-crit')}>{formatInr(v.money.netInr)}</dd>
          </div>
        </dl>
      </Card>

      <a
        href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-control bg-accent px-5 text-button font-semibold text-accent-ink hover:brightness-95 sm:w-auto sm:self-start"
      >
        <Send size={20} aria-hidden />
        {t('share')}
      </a>
    </div>
  )
}
