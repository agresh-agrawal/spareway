import { useMemo, useState } from 'react'
import { Plus, Truck as TruckIcon } from 'lucide-react'
import { EmptyState, ErrorState, MainButton, PageHeader, Skeleton, TruckStatusChip } from '@/components/common'
import { FilterChips } from '@/components/common/FilterChips'
import { useLang } from '@/lib/i18n'
import { TruckCard } from '../components/TruckCard'
import { TruckFormSheet } from '../components/TruckFormSheet'
import { useOpenTripsByTruck, useTrucks } from '../hooks'
import { TRUCK_STATUSES, type TruckStatus } from '../schemas'

type Filter = 'all' | TruckStatus

export default function TrucksPage() {
  const { t } = useLang('trucks')
  const { data, isLoading, error, refetch } = useTrucks()
  const trips = useOpenTripsByTruck()
  const [filter, setFilter] = useState<Filter>('all')
  const [adding, setAdding] = useState(false)

  const trucks = useMemo(() => data ?? [], [data])
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: trucks.length }
    for (const s of TRUCK_STATUSES) c[s] = trucks.filter((x) => x.status === s).length
    return c
  }, [trucks])
  const shown = filter === 'all' ? trucks : trucks.filter((x) => x.status === filter)
  const chips = (['all', ...TRUCK_STATUSES] as Filter[]).map((v) => ({ value: v, label: t(`filters.${v}`), count: counts[v] }))

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('title')}
        subtitle={data ? t('count', { count: trucks.length }) : undefined}
        actions={
          <MainButton icon={Plus} onClick={() => setAdding(true)}>
            {t('add')}
          </MainButton>
        }
      />
      <FilterChips label={t('filters.label')} chips={chips} value={filter} onChange={setFilter} />

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : trucks.length === 0 ? (
        <EmptyState
          icon={TruckIcon}
          text={t('empty')}
          action={
            <MainButton icon={Plus} onClick={() => setAdding(true)}>
              {t('add')}
            </MainButton>
          }
        />
      ) : (
        <>
          {/* phone + tablet: one list filtered by the chips */}
          <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
            {shown.length === 0 && <EmptyState text={t('emptyFilter')} className="sm:col-span-2" />}
            {shown.map((tr) => (
              <TruckCard key={tr.id} truck={tr} trip={trips.data?.[tr.id]} />
            ))}
          </div>
          {/* laptop: board with a column per status (Haulix reference 7) */}
          <div className="hidden gap-4 lg:grid lg:grid-cols-4">
            {TRUCK_STATUSES.filter((s) => filter === 'all' || filter === s).map((s) => {
              const col = trucks.filter((x) => x.status === s)
              return (
                <section key={s} className="flex min-w-0 flex-col gap-3 rounded-card border border-line bg-surface p-3" aria-label={t(`filters.${s}`)}>
                  <div className="flex items-center justify-between px-1">
                    <TruckStatusChip status={s} />
                    <span className="text-label text-ink-2 tabular">{col.length}</span>
                  </div>
                  {col.length === 0 ? (
                    <p className="px-1 py-4 text-center text-label text-ink-3">{t('emptyFilter')}</p>
                  ) : (
                    col.map((tr) => <TruckCard key={tr.id} truck={tr} trip={trips.data?.[tr.id]} />)
                  )}
                </section>
              )
            })}
          </div>
        </>
      )}
      <TruckFormSheet open={adding} onOpenChange={setAdding} />
    </div>
  )
}
