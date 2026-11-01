// Home: trips that are not finished (on the road, loading, planned), soonest first, each with what to do next —
// plan the load, or fill the free space with extra loads. Space numbers come from the saved load plan.
import { Link } from 'react-router'
import { ArrowRight, CalendarClock, PackagePlus, Route } from 'lucide-react'
import { Card, CardHeader, EmptyState, ErrorState, SkeletonList, TripStatusChip } from '@/components/common'
import { useTrips } from '@/features/trips'
import { useLang } from '@/lib/i18n'
import { formatDayTime } from '@/lib/format'

const OPEN = ['in_transit', 'loading', 'planned']
const MAX = 5
/** A planned trip with this much free space gets "Find extra loads". */
const FREE_PCT = 25

export function TripsNow() {
  const { t, td, lang } = useLang('home')
  const q = useTrips()
  const open = (q.data ?? [])
    .filter((x) => x.id && OPEN.includes(x.status ?? ''))
    .sort((a, b) => OPEN.indexOf(a.status ?? '') - OPEN.indexOf(b.status ?? '') || (a.planned_departure ?? '').localeCompare(b.planned_departure ?? ''))
  return (
    <Card>
      <CardHeader
        icon={Route}
        title={t('trips.title')}
        action={
          open.length > MAX ? (
            <Link to="/trips" className="flex min-h-12 items-center px-2 font-semibold text-accent">
              {t('seeAll', { count: open.length })}
            </Link>
          ) : undefined
        }
      />
      {q.isLoading ? (
        <SkeletonList rows={3} />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : open.length === 0 ? (
        <EmptyState text={t('trips.empty')} />
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {open.slice(0, MAX).map((x) => {
            const used = x.plan_volume_used_pct === null ? null : Math.round(Number(x.plan_volume_used_pct))
            const next =
              x.status === 'planned' && !x.active_plan_id
                ? { text: t('trips.planLoad'), icon: ArrowRight }
                : x.status !== 'in_transit' && used !== null && 100 - used >= FREE_PCT
                  ? { text: t('trips.freeSpace', { pct: 100 - used }), icon: PackagePlus }
                  : null
            return (
              <li key={x.id}>
                <Link to={`/trips/${x.id}`} className="flex flex-col gap-1 py-3 hover:bg-surface-2 sm:px-2">
                  <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <span className="font-semibold">
                      {x.code} · {td(x.origin_name ?? '')} → {td(x.final_stop_name ?? '')}
                    </span>
                    <TripStatusChip status={x.status ?? 'planned'} />
                  </span>
                  <span className="flex flex-wrap items-center gap-x-3 text-label text-ink-2">
                    <span className="tabular">{x.reg_no}</span>
                    {x.planned_departure && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock size={14} aria-hidden />
                        {formatDayTime(x.actual_departure ?? x.planned_departure, lang)}
                      </span>
                    )}
                    {used !== null && <span>{t('trips.used', { pct: used })}</span>}
                  </span>
                  {next && (
                    <span className="inline-flex items-center gap-1.5 font-medium text-accent">
                      <next.icon size={16} aria-hidden />
                      {next.text}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
