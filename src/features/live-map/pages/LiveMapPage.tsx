import { lazy, Suspense, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { AlertTriangle, Coffee, MapPinOff, Phone, Route as RouteIcon, Truck as TruckIcon, X } from 'lucide-react'
import { Badge, EmptyState, ErrorState, Skeleton, StatusChip, TruckStatusChip } from '@/components/common'
import { FilterChips } from '@/components/common/FilterChips'
import { Switch } from '@/components/ui/switch'
import { useLang } from '@/lib/i18n'
import { useLowData } from '@/lib/lowData'
import { formatDuration, formatKm, formatPct, formatTime } from '@/lib/format'
import { cn } from '@/lib/cn'
import { useLiveFleet, type LiveTruck } from '../hooks'

const FleetMap = lazy(() => import('../components/FleetMap'))
const STATUSES = ['active', 'idle', 'maintenance', 'offline'] as const
type Filter = 'all' | (typeof STATUSES)[number]

function TruckCard({ f, onClose }: { f: LiveTruck; onClose: () => void }) {
  const { t, td, lang } = useLang('live-map')
  const onTrip = f.trip && f.trip.status === 'in_transit'
  return (
    <div className="rounded-card border border-line-strong bg-surface/95 p-4 shadow-2xl backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[19px] leading-6 font-semibold">{f.truck.reg_no}</span>
            <TruckStatusChip status={f.truck.status} />
          </div>
          {f.fromStop && f.toStop && (
            <div className="mt-1 text-ink-2">
              {td(f.fromStop)} → {td(f.toStop)}
            </div>
          )}
        </div>
        <button onClick={onClose} aria-label={t('card.close')} className="-mt-1 -mr-1 flex size-12 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-surface-3">
          <X size={20} />
        </button>
      </div>

      {onTrip ? (
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className="text-ink-2">{t('card.progress')}</span>
            <span className="text-[18px] font-semibold tabular">{formatPct(f.progressPct)}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full bg-accent" style={{ width: `${f.progressPct}%` }} />
          </div>
          {f.arrivesAt !== null && f.kmLeft !== null && (
            <p className="font-medium tabular">{t('card.arrives', { time: formatTime(f.arrivesAt, lang), km: formatKm(f.kmLeft) })}</p>
          )}
          {f.speedKmph !== null && (
            <p className="text-ink-2 tabular">
              {f.fuelPct !== null ? t('card.readings', { speed: f.speedKmph, fuel: formatPct(f.fuelPct) }) : t('card.readingsNoFuel', { speed: f.speedKmph })}
            </p>
          )}
          {f.breakInMin !== null && f.breakInMin <= 60 && (
            <p className="flex items-center gap-2 rounded-tile border border-warn/40 bg-warn/10 p-2.5 font-medium text-warn">
              <Coffee size={18} aria-hidden />
              {t('card.breakDue', { time: formatDuration(f.breakInMin, lang) })}
            </p>
          )}
          {f.approximate && <p className="text-label text-ink-3">{t('card.approximate')}</p>}
        </div>
      ) : f.trip?.status === 'loading' ? (
        <p className="mt-3 text-ink-2">{t('card.loading', { place: td(f.trip.stops[0]?.name ?? '') })}</p>
      ) : (
        <p className="mt-3 text-ink-2">
          {t('card.noTrip')}
          {f.fuelPct !== null && ` · ${t('card.parked', { fuel: formatPct(f.fuelPct) })}`}
        </p>
      )}

      {f.hasProblem && (
        <p className="mt-2 flex items-center gap-2 text-label font-medium text-crit">
          <AlertTriangle size={16} aria-hidden />
          {t('card.problem')}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {f.truck.driver_phone && (
          <a
            href={`tel:${f.truck.driver_phone.replace(/\s+/g, '')}`}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-control border border-line-strong bg-surface-2 px-3 font-semibold hover:bg-surface-3"
          >
            <Phone size={18} aria-hidden />
            {t('common:actions.call')} {td(f.truck.driver_name).split(' ')[0]}
          </a>
        )}
        {f.trip && (
          <Link
            to={`/trips/${f.trip.id}`}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-control border border-line-strong bg-surface-2 px-3 font-semibold hover:bg-surface-3"
          >
            <RouteIcon size={18} aria-hidden />
            {t('card.openTrip')}
          </Link>
        )}
      </div>
    </div>
  )
}

/** /map — all trucks on one map (Architecture F15, Design System 7.11). */
export default function LiveMapPage() {
  const { t } = useLang('live-map')
  const { lowData } = useLowData()
  const { fleet, isLoading, error, refetch } = useLiveFleet()
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<string | null>(null)
  const [showRoutes, setShowRoutes] = useState(true)
  const [showProblems, setShowProblems] = useState(true)

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: fleet.length }
    for (const s of STATUSES) c[s] = fleet.filter((f) => f.truck.status === s).length
    return c
  }, [fleet])
  const shown = filter === 'all' ? fleet : fleet.filter((f) => f.truck.status === filter)
  const noPosition = shown.filter((f) => !f.position)
  const sel = fleet.find((f) => f.truck.id === selected) ?? null
  const chips = (['all', ...STATUSES] as Filter[]).map((v) => ({ value: v, label: t(`filters.${v}`), count: counts[v] }))

  if (error) return <ErrorState error={error} onRetry={refetch} className="mt-6" />

  return (
    <div className="flex flex-col gap-3">
      <FilterChips label={t('filters.label')} chips={chips} value={filter} onChange={setFilter} />
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <label className="flex min-h-12 items-center gap-2 font-medium">
          <Switch checked={showRoutes} onCheckedChange={setShowRoutes} />
          {t('showRoutes')}
        </label>
        <label className="flex min-h-12 items-center gap-2 font-medium">
          <Switch checked={showProblems} onCheckedChange={setShowProblems} />
          {t('showProblems')}
        </label>
      </div>

      {isLoading ? (
        <Skeleton className="h-[60dvh]" />
      ) : fleet.length === 0 ? (
        <EmptyState icon={TruckIcon} text={t('empty')} />
      ) : (
        <div className="relative">
          <Suspense fallback={<Skeleton className="h-[62dvh] lg:h-[70dvh]" />}>
            <FleetMap
              fleet={shown}
              selectedId={selected}
              onSelect={setSelected}
              showRoutes={showRoutes}
              showProblems={showProblems}
              className="h-[62dvh] lg:h-[70dvh]"
            />
          </Suspense>
          {sel && (
            <div className={cn('absolute z-10', 'inset-x-2 bottom-2 lg:inset-x-auto lg:top-3 lg:bottom-auto lg:left-3 lg:w-[360px]')}>
              <TruckCard f={sel} onClose={() => setSelected(null)} />
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-label text-ink-2">
        <Badge kind="simulated" />
        <span>{lowData ? t('footerLow') : t('footer')}</span>
      </div>

      {noPosition.length > 0 && (
        <section className="rounded-card border border-line bg-surface p-4">
          <h2 className="mb-2 flex items-center gap-2 font-semibold">
            <MapPinOff size={20} className="text-ink-2" aria-hidden />
            {t('noPositionList')}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {noPosition.map((f) => (
              <li key={f.truck.id}>
                <StatusChip tone="neutral">{f.truck.reg_no}</StatusChip>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
