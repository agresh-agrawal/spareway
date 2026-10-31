// Components this feature plugs into other pages (loaded lazily by module.tsx).
import { Link } from 'react-router'
import { Boxes, Maximize2 } from 'lucide-react'
import { Bar, EmptyState, ErrorState, QuickAction, Skeleton, StopChip } from '@/components/common'
import { useLang } from '@/lib/i18n'
import type { PackMetrics, Placement } from '@/types/domain'
import { usePlannableTrips, useTruckLayout } from '../hooks/useLayouts'
import { LoadPlanView } from './LoadPlanView'
import { SideView, TopView } from './drawings'

/** trip.steps → "Load plan" (step 2) */
export function LoadPlanStep({ tripId }: { tripId: string }) {
  return <LoadPlanView tripId={tripId} variant="step" />
}

/** home.actions → "Plan load": the next trip without an active plan (else the next trip). Nothing to plan → hidden. */
export function PlanLoadAction() {
  const { t } = useLang('load-planner')
  const { data } = usePlannableTrips()
  const target = data?.find((x) => !x.activePlanId) ?? data?.[0]
  if (!target) return null
  return <QuickAction to={`/trips/${target.trip.id}/plan`} icon={Boxes} label={t('planLoad')} />
}

const linkClass =
  'inline-flex h-12 items-center gap-2 self-start rounded-control border border-line-strong bg-surface-2 px-4 text-button font-semibold hover:bg-surface-3'

/** truck.tabs → "Load layout": top + side drawing of the current / next trip's active plan. */
export function TruckLoadLayout({ truckId }: { truckId: string }) {
  const { t } = useLang('load-planner')
  const { data, isLoading, error, refetch } = useTruckLayout(truckId)
  if (isLoading) return <Skeleton className="h-64" />
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />
  if (!data) return <EmptyState icon={Boxes} text={t('truckTab.noTrip')} />
  const { trip, plan } = data
  const canPlan = trip.status === 'planned' || trip.status === 'loading'
  const open = (
    <Link to={`/trips/${trip.id}/plan`} className={linkClass}>
      <Maximize2 size={20} aria-hidden />
      {t('truckTab.open')}
    </Link>
  )
  if (!plan)
    return <EmptyState icon={Boxes} text={t('truckTab.noPlan', { code: trip.code })} action={canPlan ? open : undefined} />

  const placements = (Array.isArray(plan.placements) ? plan.placements : []) as unknown as Placement[]
  const metrics = (plan.metrics ?? {}) as Partial<PackMetrics>
  const container = {
    lengthCm: Number(data.truck.internal_length_cm),
    widthCm: Number(data.truck.internal_width_cm),
    heightCm: Number(data.truck.internal_height_cm),
  }
  const stopSeqs = [...new Set(placements.map((p) => p.unloadOrder))].sort((a, b) => a - b)
  return (
    <div className="flex flex-col gap-4">
      <div className="text-section-title font-semibold">{t('truckTab.trip', { code: trip.code })}</div>
      <div className="grid gap-4 sm:grid-cols-2">
        {metrics.volumeUsedPct !== undefined && <Bar label={t('summary.spaceUsed')} pct={Number(metrics.volumeUsedPct)} />}
        {metrics.weightUsedPct !== undefined && <Bar label={t('summary.weight')} pct={Number(metrics.weightUsedPct)} />}
      </div>
      {placements.length === 0 ? (
        <p className="text-ink-2">{t('truckTab.noLayout')}</p>
      ) : (
        <>
          <TopView container={container} placements={placements} />
          <SideView container={container} placements={placements} bare />
          <div className="flex flex-wrap gap-2">
            {stopSeqs.map((seq) => (
              <StopChip key={seq} seq={seq} name={data.stops.find((s) => s.seq === seq)?.name ?? ''} />
            ))}
          </div>
        </>
      )}
      {open}
    </div>
  )
}
