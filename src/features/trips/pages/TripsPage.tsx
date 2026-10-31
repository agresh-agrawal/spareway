import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Plus, Route as RouteIcon } from 'lucide-react'
import { EmptyState, ErrorState, MainButton, PageHeader, Skeleton, TripStatusChip } from '@/components/common'
import { FilterChips } from '@/components/common/FilterChips'
import { useLang } from '@/lib/i18n'
import { TripCard } from '../components/TripCard'
import { useTrips } from '../hooks'

const STATUSES = ['planned', 'loading', 'in_transit', 'completed'] as const
type Status = (typeof STATUSES)[number]

export default function TripsPage() {
  const { t } = useLang('trips')
  const nav = useNavigate()
  const { data, isLoading, error, refetch } = useTrips()
  const trips = useMemo(() => (data ?? []).filter((x) => x.status !== 'cancelled'), [data])
  const [filter, setFilter] = useState<Status>('planned')
  const chips = STATUSES.map((s) => ({ value: s, label: t(`filters.${s}`), count: trips.filter((x) => x.status === s).length }))
  const shown = trips.filter((x) => x.status === filter)
  const add = (
    <MainButton icon={Plus} onClick={() => nav('/trips/new')}>
      {t('newTrip')}
    </MainButton>
  )

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('title')} subtitle={data ? t('count', { count: trips.length }) : undefined} actions={add} />
      <div className="lg:hidden">
        <FilterChips label={t('filters.label')} chips={chips} value={filter} onChange={setFilter} />
      </div>
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : trips.length === 0 ? (
        <EmptyState icon={RouteIcon} text={t('empty')} action={add} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
            {shown.length === 0 && <EmptyState text={t('emptyFilter')} className="sm:col-span-2" />}
            {shown.map((tr) => (
              <TripCard key={tr.id} trip={tr} />
            ))}
          </div>
          {/* laptop: board, a column per status */}
          <div className="hidden gap-4 lg:grid lg:grid-cols-4">
            {STATUSES.map((s) => {
              const col = trips.filter((x) => x.status === s)
              return (
                <section key={s} aria-label={t(`filters.${s}`)} className="flex min-w-0 flex-col gap-3 rounded-card border border-line bg-surface p-3">
                  <div className="flex items-center justify-between px-1">
                    <TripStatusChip status={s} />
                    <span className="text-label text-ink-2 tabular">{col.length}</span>
                  </div>
                  {col.length === 0 ? (
                    <p className="px-1 py-4 text-center text-label text-ink-3">{t('emptyFilter')}</p>
                  ) : (
                    col.map((tr) => <TripCard key={tr.id} trip={tr} />)
                  )}
                </section>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
