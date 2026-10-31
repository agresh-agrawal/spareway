import { Suspense, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Gauge,
  IndianRupee,
  LayoutGrid,
  Pencil,
  Phone,
  PlayCircle,
  Plus,
  PowerOff,
  Route as RouteIcon,
  Ruler,
  Trash2,
  Wrench,
} from 'lucide-react'
import {
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  MainButton,
  PlainButton,
  Skeleton,
  SkeletonList,
  TripStatusChip,
  TruckStatusChip,
} from '@/components/common'
import { useSlot } from '@/app/slots'
import { useLang } from '@/lib/i18n'
import { toAppError } from '@/lib/errors'
import { formatDateTime, formatTruckSize, formatWeight } from '@/lib/format'
import { cn } from '@/lib/cn'
import { TruckFormSheet } from '../components/TruckFormSheet'
import { useDeleteTruck, useSetTruckStatus, useTruck, useTruckTrips } from '../hooks'
import type { Truck } from '../api'

function Fact({ icon: Icon, label, value }: { icon: typeof Ruler; label: string; value: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-tile border border-line bg-surface-2 p-4">
      <Icon size={22} className="mt-0.5 shrink-0 text-ink-2" aria-hidden />
      <div className="min-w-0">
        <div className="text-label text-ink-2">{label}</div>
        <div className="mt-0.5 font-semibold tabular">{value}</div>
      </div>
    </div>
  )
}

function Overview({ truck }: { truck: Truck }) {
  const { t, td } = useLang('trucks')
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Fact icon={Ruler} label={t('overview.size')} value={formatTruckSize(truck.internal_length_cm, truck.internal_width_cm, truck.internal_height_cm)} />
      <Fact icon={Gauge} label={t('overview.payload')} value={formatWeight(truck.payload_kg)} />
      <Fact icon={IndianRupee} label={t('overview.costPerKm')} value={`₹${truck.cost_per_km_inr}`} />
      <Fact
        icon={Phone}
        label={t('overview.driver')}
        value={
          truck.driver_name ? (
            <span className="flex flex-wrap items-center gap-2">
              {td(truck.driver_name)}
              {truck.driver_phone && (
                <a href={`tel:${truck.driver_phone.replace(/\s+/g, '')}`} className="font-semibold text-accent">
                  {truck.driver_phone}
                </a>
              )}
            </span>
          ) : (
            t('card.noDriver')
          )
        }
      />
    </div>
  )
}

function TripsTab({ truckId }: { truckId: string }) {
  const { t, td, lang } = useLang('trucks')
  const { data, isLoading, error, refetch } = useTruckTrips(truckId)
  if (isLoading) return <SkeletonList rows={3} />
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />
  if (!data?.length) return <EmptyState icon={RouteIcon} text={t('trips.empty')} />
  return (
    <div className="flex flex-col gap-2">
      {data.map((tr) => (
        <Link
          key={tr.id}
          to={`/trips/${tr.id}`}
          className="flex flex-wrap items-center justify-between gap-2 rounded-tile border border-line bg-surface-2 p-4 hover:bg-surface-3"
        >
          <div className="min-w-0">
            <div className="font-semibold">{tr.code}</div>
            <div className="text-ink-2">
              {td(tr.origin_name)} → {td(tr.final_stop_name)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {tr.planned_departure && <span className="text-label text-ink-2">{formatDateTime(tr.planned_departure, lang)}</span>}
            <TripStatusChip status={tr.status ?? 'planned'} />
          </div>
        </Link>
      ))}
    </div>
  )
}


export default function TruckPage() {
  const { truckId = '' } = useParams()
  const { t } = useLang('trucks')
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const { data: truck, isLoading, error, refetch } = useTruck(truckId)
  const setStatus = useSetTruckStatus()
  const del = useDeleteTruck()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [hasTrips, setHasTrips] = useState(false)
  const extraTabs = useSlot('truck.tabs', { truckId })

  const tabs = [
    { id: 'overview', label: t('tabs.overview'), icon: LayoutGrid },
    { id: 'trips', label: t('tabs.trips'), icon: RouteIcon },
    ...extraTabs.map((e) => ({ id: e.id, label: e.labelKey ? t(e.labelKey) : e.id, icon: e.icon ?? LayoutGrid })),
  ]
  const tab = tabs.some((x) => x.id === params.get('tab')) ? params.get('tab')! : 'overview'

  if (isLoading)
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-48" />
      </div>
    )
  if (error || !truck) return <ErrorState error={error} onRetry={() => refetch()} className="mt-6" />

  const changeStatus = async (status: string) => {
    try {
      await setStatus.mutateAsync({ truck, status })
      toast.success(t('page.statusSaved', { reg: truck.reg_no, status: t(`common:truckStatus.${status}`) }))
    } catch (e) {
      toast.error(t(`common:errors.${toAppError(e).code}`))
    }
  }

  const remove = async () => {
    try {
      const r = await del.mutateAsync(truck.id)
      if (r === 'has_trips') {
        setConfirmDelete(false)
        setHasTrips(true)
        return
      }
      toast.success(t('page.deleted'))
      nav('/trucks', { replace: true })
    } catch (e) {
      toast.error(t(`common:errors.${toAppError(e).code}`))
    }
  }

  const Extra = extraTabs.find((e) => e.id === tab)?.component

  return (
    <div className="flex flex-col gap-4">
      <Link to="/trucks" className="inline-flex min-h-12 w-fit items-center gap-2 font-semibold text-ink-2 hover:text-ink">
        <ArrowLeft size={20} aria-hidden />
        {t('page.back')}
      </Link>

      <Card className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-[22px] leading-7 font-semibold sm:text-page-title">{truck.reg_no}</h2>
            <TruckStatusChip status={truck.status} />
          </div>
          <TruckModel model={truck.model} />
        </div>
        <div className="flex flex-wrap gap-2">
          {truck.status === 'maintenance' || truck.status === 'offline' ? (
            <PlainButton icon={PlayCircle} onClick={() => changeStatus('idle')} loading={setStatus.isPending}>
              {t('page.backToWork')}
            </PlainButton>
          ) : (
            <>
              <PlainButton icon={Wrench} onClick={() => changeStatus('maintenance')} loading={setStatus.isPending}>
                {t('page.repair')}
              </PlainButton>
              <PlainButton icon={PowerOff} onClick={() => changeStatus('offline')} loading={setStatus.isPending}>
                {t('page.off')}
              </PlainButton>
            </>
          )}
          <PlainButton icon={Pencil} onClick={() => setEditing(true)}>
            {t('page.edit')}
          </PlainButton>
          <MainButton icon={Plus} onClick={() => nav(`/trips/new?truck=${truck.id}`)}>
            {t('page.newTrip')}
          </MainButton>
        </div>
      </Card>

      <div role="tablist" className="scrollbar-none -mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
        {tabs.map((x) => (
          <button
            key={x.id}
            role="tab"
            aria-selected={tab === x.id}
            onClick={() => setParams({ tab: x.id }, { replace: true })}
            className={cn(
              'relative flex h-12 shrink-0 items-center gap-2 px-3 text-[15px] font-semibold whitespace-nowrap',
              tab === x.id ? 'text-ink' : 'text-ink-2 hover:text-ink',
            )}
          >
            <x.icon size={20} aria-hidden />
            {x.label}
            {tab === x.id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />}
          </button>
        ))}
      </div>

      {tab === 'overview' && <Overview truck={truck} />}
      {tab === 'trips' && <TripsTab truckId={truck.id} />}
      {Extra && (
        <Suspense fallback={<SkeletonList rows={3} />}>
          <Extra truckId={truck.id} />
        </Suspense>
      )}

      <div className="pt-2">
        <button
          onClick={() => setConfirmDelete(true)}
          className="inline-flex min-h-12 items-center gap-2 rounded-control px-2 font-semibold text-ink-3 hover:text-crit"
        >
          <Trash2 size={18} aria-hidden />
          {t('page.delete')}
        </button>
      </div>

      <TruckFormSheet open={editing} onOpenChange={setEditing} truck={truck} onSaved={() => refetch()} />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('page.deleteTitle', { reg: truck.reg_no })}
        text={t('page.deleteText')}
        confirmLabel={t('page.delete')}
        confirmIcon={Trash2}
        onConfirm={remove}
        loading={del.isPending}
      />
      <ConfirmDialog
        open={hasTrips}
        onOpenChange={setHasTrips}
        title={t('page.deleteTitle', { reg: truck.reg_no })}
        text={t('page.hasTrips')}
        confirmLabel={t('page.setOff')}
        confirmIcon={PowerOff}
        onConfirm={() => {
          setHasTrips(false)
          void changeStatus('offline')
        }}
      />
    </div>
  )
}

function TruckModel({ model }: { model: string }) {
  const { td } = useLang()
  if (!model) return null
  return <p className="mt-1 text-ink-2">{td(model)}</p>
}
