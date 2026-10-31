// Trip step "Route" (Design System 7.10): departure line, map, three route cards (Best, total ₹ hero),
// journey list and the driver message. One lime button: "Choose" on the Best route until a route is chosen,
// then "Send on WhatsApp".
import { lazy, Suspense, useState } from 'react'
import { toast } from 'sonner'
import { Clock, Info, MapPinned } from 'lucide-react'
import { EmptyState, ErrorState, Skeleton } from '@/components/common'
import { formatDateTime } from '@/lib/format'
import { useLang } from '@/lib/i18n'
import { toAppError } from '@/lib/errors'
import { useRoutePlanner, type PlannedRoute } from '../hooks'
import { RouteCard } from './RouteCard'
import { Journey } from './Journey'
import { DriverMessage } from './DriverMessage'

const RouteMap = lazy(() => import('./RouteMap'))

export function RouteStep({ tripId }: { tripId: string }) {
  const { t, lang } = useLang('routes')
  const p = useRoutePlanner(tripId)
  const [viewedId, setViewedId] = useState<string | undefined>()

  if (p.status === 'fewStops') return <EmptyState icon={MapPinned} text={t('fewStops')} />
  if (p.status === 'error') return <ErrorState error={p.error} onRetry={p.retry} />
  if (p.status === 'loading' || !p.basics)
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-[300px] sm:h-[420px]" />
        <div className="grid gap-3 lg:grid-cols-3">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
        <p className="text-center text-ink-2">{t('loading')}</p>
      </div>
    )

  const viewed = p.routes.find((r) => r.row.id === viewedId) ?? p.selected ?? p.routes.find((r) => r.best) ?? p.routes[0]
  const choose = async (r: PlannedRoute) => {
    try {
      await p.choose(r)
      setViewedId(r.row.id)
      toast.success(t('done'))
    } catch (err) {
      toast.error(t(`common:errors.${toAppError(err).code}`))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-2">
        <span className="inline-flex items-center gap-2 font-medium text-ink">
          <Clock size={20} aria-hidden />
          {t('leaves', { at: formatDateTime(p.departure, lang) })}
        </span>
        <span className="inline-flex items-center gap-1 text-label">
          <Info size={16} aria-hidden />
          {t('estimatedNote')}
        </span>
      </p>

      <Suspense fallback={<Skeleton className="h-[300px] sm:h-[420px]" />}>
        <RouteMap routes={p.routes} viewedId={viewed?.row.id} stops={p.basics.stops} />
      </Suspense>

      <div className="grid gap-3 lg:grid-cols-3">
        {p.routes.map((r) => (
          <RouteCard
            key={r.row.id}
            route={r}
            viewed={r === viewed}
            chosen={r === p.selected}
            lime={!p.selected && r.best}
            choosing={p.choosing === r.row.id}
            onView={() => setViewedId(r.row.id)}
            onChoose={() => void choose(r)}
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {viewed && <Journey route={viewed} stops={p.basics.stops} />}
        {p.selected ? (
          <DriverMessage route={p.selected} basics={p.basics} />
        ) : (
          <EmptyState icon={Info} text={t('driver.chooseFirst')} />
        )}
      </div>
    </div>
  )
}
