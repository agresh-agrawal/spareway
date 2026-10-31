// /earnings (Design System 7.15): 7 / 30 days, three big numbers (Earned · From extra loads · Space used),
// two simple bar charts, top trips.
import { useState } from 'react'
import { Link } from 'react-router'
import { BarChart3, Coins, PackageCheck, PackagePlus, Trophy } from 'lucide-react'
import { Badge, Card, CardHeader, EmptyState, ErrorState, PageHeader, Skeleton, TripStatusChip } from '@/components/common'
import { SimpleBarChart } from '@/components/common/SimpleBarChart'
import { formatDate, formatInr, formatPct } from '@/lib/format'
import { useLang } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import { usePeriod, useTopTrips } from '../hooks'
import { Tile } from '../components/Tile'

const PERIODS = [7, 30] as const

export default function EarningsPage() {
  const { t, lang } = useLang('analytics')
  const [days, setDays] = useState<(typeof PERIODS)[number]>(7)
  const p = usePeriod(days)
  const top = useTopTrips()
  const tot = p.totals
  const sample = tot?.sample ? <Badge kind="sample" /> : undefined
  const dayLabel = (d: string) => formatDate(d, lang).split(' ')[0]

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4">
      <PageHeader title={t('title')} subtitle={t('page.subtitle')} className="mb-0" />
      <div role="group" className="flex gap-2">
        {PERIODS.map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={days === d}
            onClick={() => setDays(d)}
            className={cn(
              'h-10 rounded-full border px-4 font-semibold transition-colors duration-200',
              days === d ? 'border-accent bg-accent-soft text-ink' : 'border-line-strong bg-surface-2 text-ink-2 hover:bg-surface-3',
            )}
          >
            {t(`page.days_${d}`)}
          </button>
        ))}
      </div>

      {p.error ? (
        <ErrorState error={p.error} onRetry={() => void p.refetch()} />
      ) : !tot ? (
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : tot.days.length === 0 ? (
        <EmptyState icon={BarChart3} text={t('page.empty')} />
      ) : (
        <>
          {sample && <div className="-mb-2">{sample}</div>}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Tile icon={Coins} value={formatInr(tot.earnedInr)} label={t('page.earned')} tone="ok" />
            <Tile icon={PackagePlus} value={formatInr(tot.extraInr)} label={t('page.extra')} />
            <Tile icon={PackageCheck} value={formatPct(tot.spaceAvgPct)} label={t('page.space')} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader icon={Coins} title={t('page.moneyChart')} action={sample} />
              <SimpleBarChart
                ariaLabel={t('page.moneyChart')}
                data={tot.days.map((d) => ({ label: dayLabel(d.day), value: d.earnedInr }))}
                format={(v) => formatInr(v)}
              />
            </Card>
            <Card>
              <CardHeader icon={PackageCheck} title={t('page.spaceChart')} action={sample} />
              <SimpleBarChart
                ariaLabel={t('page.spaceChart')}
                data={tot.days.map((d) => ({ label: dayLabel(d.day), value: d.spacePct }))}
                format={(v) => formatPct(v)}
              />
            </Card>
          </div>
        </>
      )}

      <Card>
        <CardHeader icon={Trophy} title={t('page.topTrips')} />
        {top.isLoading ? (
          <Skeleton className="h-40" />
        ) : top.error ? (
          <ErrorState error={top.error} onRetry={() => void top.refetch()} />
        ) : !top.data?.length ? (
          <EmptyState icon={Trophy} text={t('page.tripsNone')} />
        ) : (
          <ul className="flex flex-col">
            {top.data.slice(0, 5).map((f) => {
              const known = Number(f.route_cost_inr) > 0
              return (
                <li key={f.trip_id ?? f.code}>
                  <Link
                    to={`/trips/${f.trip_id}?step=earnings`}
                    className="flex min-h-14 flex-wrap items-center justify-between gap-2 border-b border-line py-3 last:border-b-0 hover:bg-surface-2"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{f.code}</span>
                      <TripStatusChip status={f.status ?? ''} />
                    </span>
                    {known ? (
                      <span className="font-semibold text-ok tabular">{formatInr(Number(f.net_earnings_inr))}</span>
                    ) : (
                      <span className="text-label text-ink-2">{t('page.noRouteTrip')}</span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
