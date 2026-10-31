import { Suspense, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { ArrowLeft, CheckCircle2, Package, PackageCheck, PlayCircle, Truck as TruckIcon } from 'lucide-react'
import {
  Card,
  ConfirmDialog,
  ErrorState,
  NextStepCard,
  PlainButton,
  Skeleton,
  SkeletonList,
  StepTabs,
  StopChip,
  TripStatusChip,
} from '@/components/common'
import { Slot, useSlot } from '@/app/slots'
import { CargoList, useCargoItems } from '@/features/cargo'
import { TruckChip } from '@/features/trucks'
import { useLang } from '@/lib/i18n'
import { toAppError } from '@/lib/errors'
import { formatDateTime } from '@/lib/format'
import { useAdvanceTrip, useTrip, useTripStops } from '../hooks'
import { nextAction, type TripAction } from '../lib/stops'

const ACTION_ICON = { start_loading: PlayCircle, leave: TruckIcon, deliver: PackageCheck } as const

export default function TripPage() {
  const { tripId = '' } = useParams()
  const { t, td, lang } = useLang('trips')
  const [params, setParams] = useSearchParams()
  const trip = useTrip(tripId)
  const stops = useTripStops(tripId)
  const cargo = useCargoItems(tripId)
  const advance = useAdvanceTrip()
  const [confirm, setConfirm] = useState<TripAction>(null)
  const stepEntries = useSlot('trip.steps', { tripId })

  if (trip.isLoading)
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-24" />
        <SkeletonList rows={3} />
      </div>
    )
  if (trip.error || !trip.data) return <ErrorState error={trip.error} onRetry={() => trip.refetch()} className="mt-6" />

  const { trip: tr, overview } = trip.data
  const action = nextAction(tr.status)
  const hasCargo = (cargo.data?.length ?? 0) > 0

  const steps = [
    { id: 'cargo', label: t('page.cargoStep'), icon: Package, done: hasCargo },
    ...stepEntries.map((e) => ({
      id: e.id,
      label: e.labelKey ? t(e.labelKey) : e.id,
      icon: e.icon,
      // the load plan step is done as soon as the trip has an active plan (known from the overview, also after a reload)
      done: (e.done ? e.done({ tripId }) : false) || (e.id === 'load-plan' && Boolean(overview.active_plan_id)),
    })),
  ]
  const current = steps.some((s) => s.id === params.get('step')) ? params.get('step')! : 'cargo'
  const go = (id: string) => setParams({ step: id }, { replace: true })

  const runAction = async (a: TripAction) => {
    if (!a) return
    try {
      await advance.mutateAsync(tr)
      const next = a === 'start_loading' ? 'loading' : a === 'leave' ? 'in_transit' : 'completed'
      toast.success(t('page.statusSaved', { status: t(`common:tripStatus.${next}`) }))
      setConfirm(null)
    } catch (e) {
      toast.error(t(`common:errors.${toAppError(e).code}`))
    }
  }
  const askAction = (a: TripAction) => (a === 'start_loading' ? void runAction(a) : setConfirm(a))

  // Next step: cargo first, then the first built step not done yet, then the status action.
  const firstOpen = steps.find((s) => s.id !== 'cargo' && !s.done)
  let next: { title: string; text?: string; label: string; onAction: () => void } | null = null
  if (tr.status !== 'completed' && tr.status !== 'cancelled') {
    if (!hasCargo && !cargo.isLoading)
      next = { title: t('page.next.addCargo'), text: t('page.next.addCargoText'), label: t('page.cargoStep'), onAction: () => go('cargo') }
    else if (firstOpen && tr.status !== 'in_transit')
      next = { title: t('page.next.step', { step: firstOpen.label }), label: t('page.next.goToStep', { step: firstOpen.label }), onAction: () => go(firstOpen.id) }
    else if (action)
      next = {
        title: t(`page.next.${action === 'start_loading' ? 'startLoading' : action}`),
        label: t(`page.${action === 'start_loading' ? 'startLoading' : action}`),
        onAction: () => askAction(action),
      }
  }

  const Extra = stepEntries.find((e) => e.id === current)?.component
  const ActionIcon = action ? ACTION_ICON[action] : CheckCircle2

  return (
    <div className="flex flex-col gap-4">
      <Link to="/trips" className="inline-flex min-h-12 w-fit items-center gap-2 font-semibold text-ink-2 hover:text-ink">
        <ArrowLeft size={20} aria-hidden />
        {t('page.back')}
      </Link>

      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-[22px] leading-7 font-semibold sm:text-page-title">{tr.code}</h2>
              <TripStatusChip status={tr.status} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-ink-2">
              {overview.reg_no && <TruckChip id={tr.truck_id} regNo={overview.reg_no} />}
              {tr.planned_departure && <span className="text-label">{t('card.departs', { when: formatDateTime(tr.planned_departure, lang) })}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Slot name="trip.actions" props={{ tripId }} />
            {action && (
              <PlainButton icon={ActionIcon} onClick={() => askAction(action)} loading={advance.isPending} className="h-[52px] px-5">
                {t(`page.${action === 'start_loading' ? 'startLoading' : action}`)}
              </PlainButton>
            )}
          </div>
        </div>
        {stops.data && stops.data.length > 0 && (
          <ol aria-label={t('page.stops')} className="scrollbar-none -mx-1 flex items-center gap-1 overflow-x-auto px-1">
            {stops.data.map((s, i) => (
              <li key={s.id} className="flex shrink-0 items-center gap-1">
                {i > 0 && <span className="text-ink-3" aria-hidden>→</span>}
                <StopChip seq={s.seq} name={s.name} />
                {s.window_end && <span className="text-label text-ink-3">{t('page.deliverBy', { when: formatDateTime(s.window_end, lang) })}</span>}
              </li>
            ))}
          </ol>
        )}
        {overview.origin_name && overview.final_stop_name && (
          <p className="sr-only">
            {td(overview.origin_name)} → {td(overview.final_stop_name)}
          </p>
        )}
      </Card>

      {/* one lime button per view (Design System 1.1): other steps have their own main button, and an empty
          cargo list has "Add item" as its main button */}
      {next && current === 'cargo' && hasCargo && <NextStepCard title={next.title} text={next.text} actionLabel={next.label} onAction={next.onAction} loading={advance.isPending} />}

      <StepTabs steps={steps} current={current} onChange={go} />

      {current === 'cargo' && <CargoList tripId={tripId} />}
      {Extra && (
        <Suspense fallback={<SkeletonList rows={3} />}>
          <Extra tripId={tripId} />
        </Suspense>
      )}

      <ConfirmDialog
        open={confirm === 'leave'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t('page.leaveTitle')}
        text={t('page.leaveText')}
        confirmLabel={t('page.leave')}
        confirmIcon={TruckIcon}
        onConfirm={() => runAction('leave')}
        loading={advance.isPending}
      />
      <ConfirmDialog
        open={confirm === 'deliver'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t('page.deliverTitle')}
        text={t('page.deliverText')}
        confirmLabel={t('page.deliver')}
        confirmIcon={PackageCheck}
        onConfirm={() => runAction('deliver')}
        loading={advance.isPending}
      />
    </div>
  )
}
