import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  BookOpen,
  CheckCircle2,
  Coffee,
  LinkIcon,
  MapPin,
  MapPinCheck,
  Moon,
  Navigation,
  PackageCheck,
  Phone,
  ReceiptIndianRupee,
  Route as RouteIcon,
  ShieldAlert,
} from 'lucide-react'
import { Card, CardHeader, LanguageButton, Logo, Skeleton, StopChip, ThemeButton } from '@/components/common'
import { challanRisks, CostSheet, FineGuide, RiskList } from '@/features/challan'
import { LANG_KEY } from '@/i18n/setup'
import { applyLang, useLang } from '@/lib/i18n'
import { toAppError } from '@/lib/errors'
import { formatDayTime, formatDuration, formatInr, formatKm, formatWeight } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Halt } from '@/types/domain'
import { addDriverExpense, getDriverTrip, markDriverStop, type DriverStop, type DriverTrip } from '../api'

const DriverMap = lazy(() => import('../components/DriverMap'))
const NavMode = lazy(() => import('../components/NavMode'))

/** Driver page language: saved on this phone, Hindi the first time (like the loader page). */
function useDriverLanguage() {
  useEffect(() => {
    try {
      if (!localStorage.getItem(LANG_KEY)) applyLang('hi', false)
    } catch {
      applyLang('hi', false)
    }
  }, [])
}

const HALT_ICON: Record<Halt['kind'], typeof Coffee> = { break: Coffee, overnight: Moon, no_entry_wait: ShieldAlert, checkpoint: ShieldAlert }

function Frame({ children, data }: { children: React.ReactNode; data?: DriverTrip }) {
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex max-w-[560px] items-center justify-between gap-3 px-4 py-3">
          {data ? (
            <div className="min-w-0">
              <div className="truncate text-[20px] leading-6 font-semibold">{data.truck.regNo}</div>
              <div className="text-label text-ink-2">{data.trip.code}</div>
            </div>
          ) : (
            <Logo />
          )}
          <div className="flex shrink-0 items-center gap-2">
            <ThemeButton />
            <LanguageButton />
          </div>
        </div>
      </header>
      <main className="mx-auto flex max-w-[560px] flex-col gap-4 px-4 pt-4 pb-10">{children}</main>
    </div>
  )
}

const mapsUrl = (s: DriverStop) => `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}&travelmode=driving`

export default function DriverPage() {
  useDriverLanguage()
  const { token = '' } = useParams()
  const { t, td, lang } = useLang('driver')
  const qc = useQueryClient()
  const [costOpen, setCostOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const key = ['driverTrip', token]
  const q = useQuery({
    queryKey: key,
    queryFn: () => getDriverTrip(token),
    refetchInterval: 60_000,
    retry: (n, e) => toAppError(e).code !== 'LINK_INVALID' && n < 2,
  })
  const mark = useMutation({
    mutationFn: (v: { stopId: string; status: 'arrived' | 'done' }) => markDriverStop(token, v.stopId, v.status),
    onSuccess: (_r, v) => {
      toast.success(v.status === 'done' ? t('deliveredSaved') : t('reachedSaved'))
      void qc.invalidateQueries({ queryKey: key })
    },
    onError: (e) => toast.error(t(`common:errors.${toAppError(e).code}`)),
  })
  const risks = useMemo(
    () =>
      q.data
        ? challanRisks({
            cargoKg: Number(q.data.cargoKg ?? 0),
            payloadKg: Number(q.data.truck.payloadKg ?? 0),
            warnings: (q.data.route?.warnings ?? []) as { code: string }[],
          })
        : [],
    [q.data],
  )

  if (q.isLoading)
    return (
      <Frame>
        <Skeleton className="h-72" />
        <Skeleton className="h-32" />
      </Frame>
    )
  if (q.error || !q.data) {
    const invalid = toAppError(q.error).code === 'LINK_INVALID'
    return (
      <Frame>
        <div className="mt-10 flex flex-col items-center gap-4 text-center">
          <span className="flex size-20 items-center justify-center rounded-full bg-crit/15 text-crit">
            <LinkIcon size={40} aria-hidden />
          </span>
          <h1 className="text-[26px] leading-8 font-semibold">{invalid ? t('ended') : t(`common:errors.${toAppError(q.error).code}`)}</h1>
          {invalid && <p className="text-[18px] leading-7 text-ink-2">{t('endedText')}</p>}
        </div>
      </Frame>
    )
  }

  const d = q.data
  const drops = d.stops.filter((s) => s.type !== 'origin')
  const next = drops.find((s) => s.status !== 'done') ?? null
  const dropOf = (id: string) => d.drops.find((x) => x.stopId === id)
  const dep = d.trip.departure ? new Date(d.trip.departure).getTime() : null
  const halts = d.route?.halts ?? []

  return (
    <Frame data={d}>
      {navOpen && (
        <Suspense fallback={<div className="fixed inset-0 z-50 bg-canvas" />}>
          <NavMode
            token={token}
            data={d}
            onClose={() => setNavOpen(false)}
            onArrived={(s) => mark.mutate({ stopId: s.id, status: 'arrived' })}
          />
        </Suspense>
      )}
      <div>
        <h1 className="text-page-title font-semibold">{t('hello', { name: d.truck.driverName.split(' ')[0] || '' })}</h1>
        <p className="mt-1 text-[18px] text-ink-2">
          {d.trip.departure ? t('leaves', { time: formatDayTime(d.trip.departure, lang) }) : t('noDeparture')}
        </p>
      </div>

      {next ? (
        <Card className="border-2 border-accent">
          <p className="text-[16px] font-semibold text-ink-2">{t('nextStop')}</p>
          <p className="mt-1 text-[26px] leading-8 font-semibold">{td(next.name)}</p>
          <div className="mt-2 grid gap-1 text-[18px] leading-7">
            {next.eta && <p className="font-semibold">{t('reachBy', { time: formatDayTime(next.eta, lang) })}</p>}
            {next.windowEnd && <p className="text-ink-2">{t('deliverBy', { time: formatDayTime(next.windowEnd, lang) })}</p>}
            {dropOf(next.id) && (
              <p className="text-ink-2">
                {t('dropHere', { pieces: dropOf(next.id)!.pieces, kg: formatWeight(dropOf(next.id)!.kg) })}
                {dropOf(next.id)!.fragile && ` · ${t('fragile')}`}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            className="mt-4 flex min-h-16 w-full items-center justify-center gap-3 rounded-control bg-accent px-3 py-2 text-accent-ink"
          >
            <Navigation size={26} aria-hidden />
            <span className="text-left">
              <span className="block text-[20px] leading-6 font-semibold">{t('navStart')}</span>
              <span className="block text-[14px] opacity-80">{t('navStartHelp')}</span>
            </span>
          </button>
          <a
            href={mapsUrl(next)}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-control border border-line-strong bg-surface-2 text-[17px] font-semibold"
          >
            <MapPin size={20} aria-hidden />
            {t('navigateGoogle')}
          </a>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={next.status === 'arrived' || mark.isPending}
              onClick={() => mark.mutate({ stopId: next.id, status: 'arrived' })}
              className="inline-flex h-16 items-center justify-center gap-2 rounded-control border border-line-strong bg-surface-2 text-[18px] font-semibold disabled:opacity-50"
            >
              <MapPinCheck size={22} aria-hidden />
              {next.status === 'arrived' ? t('reachedDone') : t('reached')}
            </button>
            <button
              type="button"
              disabled={mark.isPending}
              onClick={() => mark.mutate({ stopId: next.id, status: 'done' })}
              className="inline-flex h-16 items-center justify-center gap-2 rounded-control border border-ok/50 bg-ok/10 text-[18px] font-semibold text-ok disabled:opacity-50"
            >
              <PackageCheck size={22} aria-hidden />
              {t('delivered')}
            </button>
          </div>
        </Card>
      ) : (
        <Card className="flex items-center gap-3 border-ok/50">
          <CheckCircle2 size={32} className="shrink-0 text-ok" aria-hidden />
          <p className="text-[20px] font-semibold">{t('allDelivered')}</p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-2">
        {d.company.phone ? (
          <a
            href={`tel:${d.company.phone.replace(/\s/g, '')}`}
            className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-card border border-line-strong bg-surface p-3 text-center text-[18px] font-semibold"
          >
            <Phone size={28} className="text-accent" aria-hidden />
            {t('callOwner')}
          </a>
        ) : (
          <div className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-card border border-line bg-surface p-3 text-center text-ink-2">
            <Phone size={28} aria-hidden />
            {t('noPhone')}
          </div>
        )}
        <button
          type="button"
          onClick={() => setCostOpen(true)}
          className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-card border border-line-strong bg-surface p-3 text-center text-[18px] font-semibold"
        >
          <ReceiptIndianRupee size={28} className="text-warn" aria-hidden />
          {t('paidChallan')}
        </button>
      </div>

      <Card>
        <CardHeader icon={ShieldAlert} title={t('careful')} />
        <RiskList risks={risks} big />
        <details className="mt-3 rounded-tile border border-line bg-surface-2 p-3">
          <summary className="flex min-h-10 cursor-pointer items-center gap-2 text-[18px] font-semibold">
            <BookOpen size={20} aria-hidden />
            {t('avoidChallan')}
          </summary>
          <div className="mt-3">
            <FineGuide big />
          </div>
        </details>
      </Card>

      <Card className="overflow-hidden p-0">
        <Suspense fallback={<Skeleton className="h-80 rounded-none" />}>
          <DriverMap stops={d.stops} geometry={d.route?.geometry ?? null} />
        </Suspense>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4 text-[17px] text-ink-2">
          <RouteIcon size={18} aria-hidden />
          {d.route ? (
            <>
              <span className="font-semibold text-ink">{t(`variant.${d.route.variant}`)}</span>
              <span className="tabular">{formatKm(Number(d.route.distanceKm))}</span>
              <span className="tabular">{formatDuration(Number(d.route.durationMin), lang)}</span>
              <span>{t('tolls', { count: d.route.tollCount })}</span>
            </>
          ) : (
            <span>{t('noRoute')}</span>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader icon={MapPin} title={t('stops')} />
        <ol className="flex flex-col divide-y divide-line">
          {d.stops.map((s) => {
            const drop = dropOf(s.id)
            return (
              <li key={s.id} className={cn('flex items-start gap-3 py-3 text-[17px]', s.status === 'done' && 'opacity-60')}>
                <StopChip seq={s.seq} name={s.name} />
                <div className="ml-auto text-right">
                  {s.status === 'done' ? (
                    <span className="font-semibold text-ok">{t('done')}</span>
                  ) : s.status === 'arrived' ? (
                    <span className="font-semibold text-accent">{t('reachedDone')}</span>
                  ) : s.eta ? (
                    <span className="font-semibold tabular">{formatDayTime(s.eta, lang)}</span>
                  ) : null}
                  {drop && (
                    <span className="block text-ink-2">
                      {t('pieces', { count: drop.pieces })} · {formatWeight(drop.kg)}
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      </Card>

      {halts.length > 0 && dep !== null && (
        <Card>
          <CardHeader icon={Coffee} title={t('halts')} />
          <ul className="flex flex-col gap-3">
            {halts.map((h, i) => {
              const Icon = HALT_ICON[h.kind] ?? Coffee
              return (
                <li key={i} className="flex items-start gap-3 text-[17px]">
                  <Icon size={22} className="mt-0.5 shrink-0 text-ink-2" aria-hidden />
                  <span className="flex-1">
                    <span className="font-semibold">{t(`halt.${h.kind}`, { time: formatDuration(h.durationMin, lang) })}</span>
                    <span className="block text-ink-2">
                      {formatDayTime(dep + h.atMin * 60_000, lang)} · {h.name ? td(h.name) : t('byTheRoad')}
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {(d.expenses ?? []).length > 0 && (
        <Card>
          <CardHeader icon={ReceiptIndianRupee} title={t('myCosts')} />
          <ul className="flex flex-col divide-y divide-line">
            {d.expenses.map((e, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3 py-2 text-[17px]">
                <span>
                  {t(`common:costKinds.${e.kind}`)}
                  <span className="block text-label text-ink-2">{formatDayTime(e.at, lang)}{e.note ? ` · ${e.note}` : ''}</span>
                </span>
                <span className="font-semibold tabular">{formatInr(Number(e.amount))}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <CostSheet
        open={costOpen}
        onOpenChange={setCostOpen}
        onSave={async (kind, amount, note) => {
          await addDriverExpense(token, kind, amount, note)
          void qc.invalidateQueries({ queryKey: key })
        }}
      />
    </Frame>
  )
}
