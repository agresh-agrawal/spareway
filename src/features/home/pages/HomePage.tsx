import { useEffect, useState } from 'react'
import { Activity as ActivityIcon, AlertTriangle, BarChart3, CheckCircle2, Route, Truck, Zap } from 'lucide-react'
import {
  Badge,
  BigTile,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  ProblemCard,
  Skeleton,
  SkeletonList,
} from '@/components/common'
import { SimpleBarChart } from '@/components/common/SimpleBarChart'
import { Slot, useSlot } from '@/app/slots'
import { useAuth } from '@/app/auth/AuthProvider'
import { useLang } from '@/lib/i18n'
import { formatDate, formatLongDate, formatPct, formatRelative, istHour } from '@/lib/format'
import {
  useChipLabels,
  useDashboardStats,
  useOpenProblems,
  useRecentActivity,
  useResolveProblem,
  useWeekStats,
} from '../hooks'

const MAX_PROBLEMS = 5

function Greeting() {
  const { t, lang } = useLang('home')
  const { profile } = useAuth()
  const h = istHour()
  const part = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
  const name = (profile?.full_name ?? '').split(' ')[0] || ''
  return (
    <div className="mb-5">
      <h2 className="text-[22px] leading-7 font-semibold sm:text-page-title">{t(`greeting.${part}`, { name })}</h2>
      <p className="mt-1 text-ink-2">{formatLongDate(new Date(), lang)}</p>
    </div>
  )
}

function Tiles() {
  const { t } = useLang('home')
  const stats = useDashboardStats()
  const problems = useOpenProblems()
  if (stats.isLoading)
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-36" />
        ))}
      </div>
    )
  if (stats.error) return <ErrorState error={stats.error} onRetry={() => stats.refetch()} />
  const s = stats.data
  const count = problems.data?.length ?? 0
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <BigTile
        icon={Truck}
        tone="ok"
        value={t('tiles.trucksOf', { n: s?.active_trucks ?? 0, total: s?.total_trucks ?? 0 })}
        label={t('tiles.trucksWorking')}
        to="/trucks"
      />
      <BigTile icon={Route} tone="default" value={s?.live_trips ?? 0} label={t('tiles.tripsOnRoad')} to="/trips" />
      <BigTile
        icon={count > 0 ? AlertTriangle : CheckCircle2}
        tone={count > 0 ? 'crit' : 'ok'}
        value={count}
        label={t('tiles.problems')}
        to="#problems"
      />
    </div>
  )
}

function QuickActions() {
  const { t } = useLang('home')
  const entries = useSlot('home.actions', {})
  if (entries.length === 0) return null
  return (
    <Card>
      <CardHeader icon={Zap} title={t('quick')} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Slot name="home.actions" props={{}} />
      </div>
    </Card>
  )
}

function Problems() {
  const { t, tm } = useLang('home')
  const { data, isLoading, error, refetch } = useOpenProblems()
  const chips = useChipLabels()
  const resolve = useResolveProblem()
  const [all, setAll] = useState(false)

  useEffect(() => {
    if (window.location.hash === '#problems') document.getElementById('problems')?.scrollIntoView({ block: 'start' })
  }, [])

  const list = data ?? []
  const shown = all ? list : list.slice(0, MAX_PROBLEMS)
  return (
    <Card id="problems" className="scroll-mt-24">
      <CardHeader
        icon={AlertTriangle}
        title={t('problems')}
        action={
          list.length > MAX_PROBLEMS ? (
            <button onClick={() => setAll((a) => !a)} className="min-h-12 px-2 font-semibold text-accent">
              {all ? t('showFewer') : t('seeAll', { count: list.length })}
            </button>
          ) : undefined
        }
      />
      {isLoading ? (
        <SkeletonList rows={3} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : list.length === 0 ? (
        <EmptyState icon={CheckCircle2} tone="ok" text={t('allGood')} />
      ) : (
        <div className="flex flex-col gap-2.5">
          {shown.map((a) => {
            const chip = (a.trip_id && chips.data?.trips[a.trip_id]) || (a.truck_id && chips.data?.trucks[a.truck_id])
            const meta = a.meta as Record<string, unknown>
            const title = tm(a.kind, meta, a.title)
            return (
              <ProblemCard
                key={a.id}
                severity={a.severity}
                title={title}
                chip={chip ? <span className="rounded-full bg-surface-3 px-2 py-0.5 font-medium text-ink">{chip}</span> : null}
                createdAt={a.created_at}
                onDone={() => resolve.mutate(a.id)}
                busy={resolve.isPending && resolve.variables === a.id}
              />
            )
          })}
        </div>
      )}
    </Card>
  )
}

function RecentActivity() {
  const { t, tm, lang } = useLang('home')
  const { data, isLoading, error, refetch } = useRecentActivity()
  return (
    <Card>
      <CardHeader icon={ActivityIcon} title={t('activity')} />
      {isLoading ? (
        <SkeletonList rows={4} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : !data?.length ? (
        <EmptyState text={t('noActivity')} />
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {data.map((a) => (
            <li key={a.id} className="flex items-center gap-3 py-3">
              <span className="size-2 shrink-0 rounded-full bg-ink-3" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{tm(a.kind, a.meta as Record<string, unknown>, a.message)}</span>
              <span className="shrink-0 text-label text-ink-3">{formatRelative(a.created_at, lang)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function ThisWeek() {
  const { t, lang } = useLang('home')
  const { data, isLoading, error, refetch } = useWeekStats()
  const sample = data?.some((d) => d.is_sample)
  return (
    <Card>
      <CardHeader icon={BarChart3} title={t('week')} action={sample ? <Badge kind="sample" /> : undefined} />
      <p className="mb-2 text-ink-2">{t('spaceChart')}</p>
      {isLoading ? (
        <Skeleton className="h-[180px]" />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : !data?.length ? (
        <EmptyState icon={BarChart3} text={t('noStats')} />
      ) : (
        <SimpleBarChart
          ariaLabel={t('spaceChart')}
          data={data.map((d) => ({ label: formatDate(d.day, lang).split(' ')[0], value: Number(d.utilisation_pct) }))}
          format={(v) => formatPct(v)}
        />
      )}
    </Card>
  )
}

export default function HomePage() {
  return (
    <div className="flex flex-col gap-4">
      <Greeting />
      <Tiles />
      <QuickActions />
      <div className="grid gap-4 lg:grid-cols-2">
        <Problems />
        <div className="flex flex-col gap-4">
          <RecentActivity />
          <ThisWeek />
        </div>
      </div>
      <Slot name="home.widgets" props={{}} />
    </div>
  )
}
