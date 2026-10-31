import { lazy, Suspense } from 'react'
import { Link } from 'react-router'
import { Map as MapIcon } from 'lucide-react'
import { Card, CardHeader, EmptyState, ErrorState, Skeleton } from '@/components/common'
import { useLang } from '@/lib/i18n'
import { useLiveFleet } from '../hooks'

const FleetMap = lazy(() => import('./FleetMap'))

/** Home (main dashboard): where the trucks are now, with their chosen routes (slot home.widgets). */
export function HomeMap() {
  const { t } = useLang('live-map')
  const { fleet, isLoading, error, refetch } = useLiveFleet()
  const placed = fleet.filter((f) => f.position)
  const moving = fleet.filter((f) => f.trip && f.trip.status !== 'loading').length
  return (
    <Card>
      <CardHeader
        icon={MapIcon}
        title={t('home.title')}
        action={
          <Link to="/map" className="inline-flex min-h-12 items-center px-2 font-semibold text-accent">
            {t('openMap')}
          </Link>
        }
      />
      {isLoading ? (
        <Skeleton className="h-80" />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : placed.length === 0 ? (
        <EmptyState icon={MapIcon} text={t('home.empty')} />
      ) : (
        <>
          <p className="mb-3 text-ink-2">{t('home.summary', { count: placed.length, moving })}</p>
          <Suspense fallback={<Skeleton className="h-80" />}>
            <FleetMap fleet={placed} selectedId={null} onSelect={() => {}} showRoutes className="h-80 sm:h-96" />
          </Suspense>
        </>
      )}
    </Card>
  )
}
