import { Suspense, useEffect, useState } from 'react'
import { Activity as ActivityIcon, AlertTriangle, CheckCircle2, Route, Truck, Zap } from 'lucide-react'
import {
  BigTile,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  ProblemCard,
  Skeleton,
  SkeletonList,
} from '@/components/common'
import { Slot, useSlot } from '@/app/slots'
import { useAuth } from '@/app/auth/AuthProvider'
import { useLang } from '@/lib/i18n'
import { formatLongDate, formatRelative, istHour } from '@/lib/format'
import {
  useChipLabels,
  useDashboardStats,
  useOpenProblems,
  useRecentActivity,
  useResolveProblem,
} from '../hooks'
import { TripsNow } from '../components/TripsNow'

const MAX_PROBLEMS = 5

function Greeting() {
  const { t, lang } = useLang('home')
  const { profile } = useAuth()
  const h = istHour()
  const part = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
  const name = (profile?.full_name ?? '').split(' ')[0] || ''
  return (
    <div>
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

const MAP_WIDGET = 'live-map'

/** home.widgets entries, the live map apart so it can sit near the top. */
function Widgets({ map }: { map: boolean }) {
  const entries = useSlot('home.widgets', {}).filter((e) => (e.id === MAP_WIDGET) === map)
  return (
    <>
      {entries.map((e) => {
        const C = e.component
        return (
          <Suspense key={e.id} fallback={<Skeleton className="h-72" />}>
            <C />
          </Suspense>
        )
      })}
    </>
  )
}

export default function HomePage() {
  const hasMap = useSlot('home.widgets', {}).some((e) => e.id === MAP_WIDGET)
  return (
    <div className="flex flex-col gap-4">
      <Greeting />
      <Tiles />
      {/* the map first on phones; beside the trips on wide screens */}
      <div className="grid gap-4 lg:grid-cols-5">
        {hasMap && (
          <div className="min-w-0 lg:col-span-3">
            <Widgets map />
          </div>
        )}
        <div className={hasMap ? 'min-w-0 lg:col-span-2' : 'min-w-0 lg:col-span-5'}>
          <TripsNow />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Widgets map={false} />
      </div>
      <QuickActions />
      <div className="grid gap-4 lg:grid-cols-2">
        <Problems />
        <RecentActivity />
      </div>
    </div>
  )
}
