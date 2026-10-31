import { lazy, Suspense, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, MapPin, Plus, Search, Trash2, Truck as TruckIcon } from 'lucide-react'
import {
  Card,
  EmptyState,
  ErrorState,
  MainButton,
  NumberField,
  PageHeader,
  PlainButton,
  Skeleton,
  StepTabs,
  StopChip,
  TruckStatusChip,
} from '@/components/common'
import { useTrucks } from '@/features/trucks'
import { useLang } from '@/lib/i18n'
import { toAppError } from '@/lib/errors'
import { formatFt, formatWeight } from '@/lib/format'
import { cn } from '@/lib/cn'
import { useCreateTrip } from '../hooks'
import { places, searchPlaces, type Place } from '../lib/places'
import { moveItem } from '../lib/stops'
import { wizardSchema, type WizardStop } from '../schemas'

const StopsMap = lazy(() => import('../components/StopsMap'))

/** datetime-local value for tomorrow 06:00 (the device clock; owners are in IST) */
function tomorrowSix(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(6, 0, 0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T06:00`
}

let keySeq = 0
const toStop = (p: Place, type: WizardStop['stop_type']): WizardStop => ({
  key: `${p.id}-${++keySeq}`,
  name: p.name,
  city: p.city,
  lat: p.lat,
  lng: p.lng,
  stop_type: type,
})

export default function NewTripPage() {
  const { t, td } = useLang('trips')
  const nav = useNavigate()
  const [params] = useSearchParams()
  const trucks = useTrucks()
  const create = useCreateTrip()
  const [step, setStep] = useState(0)
  const [truckId, setTruckId] = useState(params.get('truck') ?? '')
  const [stops, setStops] = useState<WizardStop[]>([])
  const [q, setQ] = useState('')
  const [departure, setDeparture] = useState(tomorrowSix)
  const [freight, setFreight] = useState<number>(Number.NaN)
  const [error, setError] = useState<string | null>(null)

  const truck = trucks.data?.find((x) => x.id === truckId)
  const results = useMemo(() => searchPlaces(q).slice(0, q ? 8 : 6), [q])
  const drops = stops.filter((s) => s.stop_type !== 'origin')

  const pick = (p: Place) => {
    setStops((s) => (s.length === 0 ? [toStop(p, 'origin')] : [...s, toStop(p, 'drop')]))
    setQ('')
    setError(null)
  }
  // the first stop is always the origin
  const reorder = (i: number, dir: -1 | 1) =>
    setStops((s) => moveItem(s, i, dir).map((x, j) => ({ ...x, stop_type: j === 0 ? 'origin' : x.stop_type === 'origin' ? 'drop' : x.stop_type })))
  const remove = (i: number) =>
    setStops((s) => s.filter((_, j) => j !== i).map((x, j) => ({ ...x, stop_type: j === 0 ? 'origin' : x.stop_type === 'origin' ? 'drop' : x.stop_type })))

  const steps = [
    { id: '0', label: t('wizard.step1'), done: Boolean(truck) },
    { id: '1', label: t('wizard.step2'), done: stops.length >= 2 },
    { id: '2', label: t('wizard.step3'), done: false },
  ]

  const canNext = step === 0 ? Boolean(truck) : step === 1 ? stops.length >= 2 : true
  const next = () => {
    if (step === 0 && !truck) return setError(t('errors.truck'))
    if (step === 1 && stops.length < 1) return setError(t('errors.origin'))
    if (step === 1 && stops.length < 2) return setError(t('errors.drops'))
    setError(null)
    setStep((s) => s + 1)
  }

  const submit = async () => {
    const parsed = wizardSchema.safeParse({ truckId, stops, departure, freight: Number.isNaN(freight) ? 0 : freight })
    if (!parsed.success) {
      setError(t(parsed.error.issues[0]?.message ?? 'errors.departure'))
      return
    }
    try {
      const r = await create.mutateAsync({
        truckId,
        stops,
        departure: new Date(departure).toISOString(),
        freight: parsed.data.freight,
      })
      toast.success(t('wizard.created', { code: r.code }))
      nav(`/trips/${r.id}`, { replace: true })
    } catch (e) {
      setError(t(`common:errors.${toAppError(e).code}`)) // the wizard keeps everything typed
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 pb-28">
      <PageHeader title={t('wizard.title')} />
      <StepTabs steps={steps} current={String(step)} onChange={(id) => Number(id) <= step && setStep(Number(id))} />

      {step === 0 && (
        <Card>
          <h2 className="mb-4 text-section-title font-semibold">{t('wizard.chooseTruck')}</h2>
          {trucks.isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : trucks.error ? (
            <ErrorState error={trucks.error} onRetry={() => trucks.refetch()} />
          ) : !trucks.data?.length ? (
            <EmptyState
              icon={TruckIcon}
              text={t('wizard.noTrucks')}
              action={
                <MainButton icon={Plus} onClick={() => nav('/trucks')}>
                  {t('wizard.addTruck')}
                </MainButton>
              }
            />
          ) : (
            <div role="radiogroup" aria-label={t('wizard.chooseTruck')} className="grid gap-3 sm:grid-cols-2">
              {trucks.data.map((tr) => {
                const on = tr.id === truckId
                return (
                  <button
                    key={tr.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => {
                      setTruckId(tr.id)
                      setError(null)
                    }}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-tile border p-4 text-left transition-colors duration-200',
                      on ? 'border-accent bg-accent-soft' : 'border-line bg-surface-2 hover:bg-surface-3',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold">{tr.reg_no}</span>
                      <span className="block text-ink-2 tabular">
                        {formatFt(tr.internal_length_cm).replace('.0 ft', ' ft')} · {formatWeight(tr.payload_kg)}
                      </span>
                    </span>
                    {on ? <Check size={22} className="shrink-0 text-accent" aria-hidden /> : <TruckStatusChip status={tr.status} />}
                  </button>
                )
              })}
            </div>
          )}
        </Card>
      )}

      {step === 1 && (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
          <Card className="flex flex-col gap-4">
            <div>
              <h2 className="text-section-title font-semibold">{t('wizard.stopsTitle')}</h2>
              <p className="mt-1 text-ink-2">{t('wizard.stopsHelp')}</p>
            </div>
            {stops.length > 0 && (
              <ol className="flex flex-col gap-2">
                {stops.map((s, i) => (
                  <li key={s.key} className="rounded-tile border border-line bg-surface-2 p-3">
                    <div className="flex items-center gap-2">
                      <StopChip seq={i} name={s.name} className="min-w-0 flex-1" />
                      <span className="hidden text-label text-ink-3 sm:inline">{i === 0 ? t('wizard.origin') : t('wizard.drop', { n: i })}</span>
                      <button type="button" onClick={() => reorder(i, -1)} disabled={i === 0} aria-label={t('wizard.moveUp')} className="flex size-10 items-center justify-center rounded-full text-ink-2 hover:bg-surface-3 disabled:opacity-30">
                        <ArrowUp size={18} />
                      </button>
                      <button type="button" onClick={() => reorder(i, 1)} disabled={i === stops.length - 1} aria-label={t('wizard.moveDown')} className="flex size-10 items-center justify-center rounded-full text-ink-2 hover:bg-surface-3 disabled:opacity-30">
                        <ArrowDown size={18} />
                      </button>
                      <button type="button" onClick={() => remove(i)} aria-label={t('wizard.remove')} className="flex size-10 items-center justify-center rounded-full text-ink-2 hover:bg-surface-3 hover:text-crit">
                        <Trash2 size={18} />
                      </button>
                    </div>
                    {i > 0 && (
                      <label className="mt-2 flex flex-col gap-1 text-label text-ink-2">
                        {t('wizard.deliverBy')}
                        <input
                          type="datetime-local"
                          value={s.deliverBy ?? ''}
                          onChange={(e) => setStops((all) => all.map((x) => (x.key === s.key ? { ...x, deliverBy: e.target.value } : x)))}
                          className="h-12 rounded-control border border-line-strong bg-surface px-3 text-[16px] text-ink focus:border-accent focus:outline-none"
                        />
                      </label>
                    )}
                  </li>
                ))}
              </ol>
            )}
            <div>
              <div className="mb-2 font-semibold">{stops.length === 0 ? t('wizard.chooseOrigin') : t('wizard.addDrop')}</div>
              <div className="relative">
                <Search size={20} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-3" aria-hidden />
                <input
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t('wizard.search')}
                  aria-label={t('wizard.searchLabel')}
                  className="h-12 w-full rounded-control border border-line-strong bg-surface-2 pr-4 pl-11 text-[16px] placeholder:text-ink-3 focus:border-accent focus:outline-none"
                />
              </div>
              <ul className="mt-2 flex flex-col">
                {results.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => pick(p)} className="flex min-h-12 w-full items-center gap-3 rounded-[10px] px-3 text-left hover:bg-surface-3">
                      <MapPin size={18} className="shrink-0 text-ink-2" aria-hidden />
                      <span className="min-w-0 flex-1 truncate font-medium">{td(p.name)}</span>
                      <span className="text-label text-ink-3">{p.state}</span>
                      <Plus size={18} className="text-accent" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
          <div className="flex flex-col gap-2">
            <p className="text-label text-ink-2">{t('wizard.pickOnMap')}</p>
            <Suspense fallback={<Skeleton className="h-72 lg:h-[420px]" />}>
              <StopsMap hubs={places} stops={stops} onPick={pick} />
            </Suspense>
          </div>
        </div>
      )}

      {step === 2 && (
        <Card className="flex flex-col gap-4">
          <h2 className="text-section-title font-semibold">{t('wizard.departureTitle')}</h2>
          {truck && stops.length >= 2 && (
            <p className="rounded-tile bg-surface-2 p-3 text-ink-2">
              {t('wizard.summary', {
                truck: truck.reg_no,
                from: td(stops[0].name),
                to: td(stops.at(-1)!.name),
                drops: t('card.drops', { count: drops.length }),
              })}
            </p>
          )}
          <label className="flex flex-col gap-1.5">
            <span className="text-label font-medium text-ink-2">{t('wizard.departure')}</span>
            <input
              type="datetime-local"
              value={departure}
              onChange={(e) => setDeparture(e.target.value)}
              className="h-12 rounded-control border border-line-strong bg-surface-2 px-4 text-[16px] text-ink focus:border-accent focus:outline-none"
            />
          </label>
          <NumberField
            label={t('wizard.freight')}
            help={t('wizard.freightHelp')}
            unit="₹"
            min={0}
            value={Number.isNaN(freight) ? '' : freight}
            onChange={(e) => setFreight(e.target.value === '' ? Number.NaN : Number(e.target.value))}
          />
        </Card>
      )}

      {error && (
        <p role="alert" className="rounded-tile border border-crit/40 bg-crit/[0.08] p-3 text-crit">
          {error}
        </p>
      )}

      <div className="safe-bottom fixed inset-x-0 bottom-16 z-20 border-t border-line-strong bg-surface/95 backdrop-blur lg:bottom-0 lg:pl-[124px]">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          {step > 0 ? (
            <PlainButton icon={ArrowLeft} onClick={() => setStep((s) => s - 1)} className="flex-1 sm:flex-none">
              {t('wizard.back')}
            </PlainButton>
          ) : (
            <span className="hidden flex-1 sm:block" />
          )}
          <span className="hidden flex-1 sm:block" />
          {step < 2 ? (
            <MainButton icon={ArrowRight} onClick={next} disabled={!canNext} className="flex-1 sm:flex-none">
              {t('wizard.next')}
            </MainButton>
          ) : (
            <MainButton icon={Check} onClick={submit} loading={create.isPending} className="flex-1 sm:flex-none">
              {t('wizard.create')}
            </MainButton>
          )}
        </div>
      </div>
    </div>
  )
}
