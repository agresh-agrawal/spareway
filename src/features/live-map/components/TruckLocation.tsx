import { lazy, Suspense } from 'react'
import { Link } from 'react-router'
import { MapPinOff, Map as MapIcon } from 'lucide-react'
import { Badge, EmptyState, ErrorState, Skeleton } from '@/components/common'
import { useLang } from '@/lib/i18n'
import { useLiveFleet } from '../hooks'

const FleetMap = lazy(() => import('./FleetMap'))

/** Truck page tab "Location" (slot truck.tabs). */
export function TruckLocation({ truckId }: { truckId: string }) {
  const { t } = useLang('live-map')
  const { fleet, isLoading, error, refetch } = useLiveFleet()
  if (isLoading) return <Skeleton className="h-72" />
  if (error) return <ErrorState error={error} onRetry={refetch} />
  const f = fleet.find((x) => x.truck.id === truckId)
  if (!f?.position) return <EmptyState icon={MapPinOff} text={t('tabEmpty')} />
  return (
    <div className="flex flex-col gap-2">
      <Suspense fallback={<Skeleton className="h-72" />}>
        <FleetMap fleet={[f]} selectedId={truckId} onSelect={() => {}} showRoutes showProblems className="h-72" />
      </Suspense>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge kind="simulated" />
        <Link to="/map" className="inline-flex min-h-12 items-center gap-2 font-semibold text-accent">
          <MapIcon size={18} aria-hidden />
          {t('openMap')}
        </Link>
      </div>
    </div>
  )
}
