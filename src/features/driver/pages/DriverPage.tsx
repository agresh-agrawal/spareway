import { lazy, Suspense, useEffect } from 'react'
import { useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Coffee, LinkIcon, MapPin, Moon, Navigation, Phone, Route as RouteIcon, ShieldAlert, Truck } from 'lucide-react'
import { Card, CardHeader, LanguageButton, Logo, Skeleton, StopChip, ThemeButton } from '@/components/common'
import { LANG_KEY } from '@/i18n/setup'
import { applyLang, useLang } from '@/lib/i18n'
import { toAppError } from '@/lib/errors'
import { formatDayTime, formatDuration, formatKm, formatWeight } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Halt } from '@/types/domain'
import { getDriverTrip, type DriverStop, type DriverTrip } from '../api'

const DriverMap = lazy(() => import('../components/DriverMap'))

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
  const q = useQuery({
    queryKey: ['driverTrip', token],
    queryFn: () => getDriverTrip(token),
    refetchInterval: 60_000,
    retry: (n, e) => toAppError(e).code !== 'LINK_INVALID' && n < 2,
  })

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
      <div>
        <h1 className="text-page-title font-semibold">{t('hello', { name: d.truck.driverName.split(' ')[0] || '' })}</h1>
        <p className="mt-1 text-ink-2">
          {d.trip.departure ? t('leaves', { time: formatDayTime(d.trip.departure, lang) }) : t('noDeparture')}
        </p>
      </div>

      {next && (
        <Card className="border-accent">
          <p className="text-label font-semibold text-ink-2">{t('nextStop')}</p>
          <div className="mt-2 flex items-center gap-3">
            <StopChip seq={next.seq} name={next.name} />
          </div>
          <div className="mt-3 grid gap-1 text-[17px]">
            {next.eta && <p className="font-semibold">{t('reachBy', { time: formatDayTime(next.eta, lang) })}</p>}
            {next.windowEnd && <p className="text-ink-2">{t('deliverBy', { time: formatDayTime(next.windowEnd, lang) })}</p>}
            {dropOf(next.id) && (
              <p className="text-ink-2">
                {t('dropHere', { pieces: dropOf(next.id)!.pieces, kg: formatWeight(dropOf(next.id)!.kg) })}
                {dropOf(next.id)!.fragile && ` · ${t('fragile')}`}
              </p>
            )}
          </div>
          <a
            href={mapsUrl(next)}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex h-14 w-full items-center justify-center gap-2 rounded-control bg-accent text-[18px] font-semibold text-accent-ink"
          >
            <Navigation size={20} aria-hidden />
            {t('navigate')}
          </a>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <Suspense fallback={<Skeleton className="h-80 rounded-none" />}>
          <DriverMap stops={d.stops} geometry={d.route?.geometry ?? null} />
        </Suspense>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4 text-ink-2">
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
              <li key={s.id} className={cn('flex items-start gap-3 py-3', s.status === 'done' && 'opacity-60')}>
                <StopChip seq={s.seq} name={s.name} />
                <div className="ml-auto text-right text-[15px]">
                  {s.status === 'done' ? (
                    <span className="font-semibold text-ok">{t('done')}</span>
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
                <li key={i} className="flex items-start gap-3">
                  <Icon size={20} className="mt-0.5 shrink-0 text-ink-2" aria-hidden />
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

      <Card>
        <CardHeader icon={Truck} title={d.company.name} />
        {d.company.phone ? (
          <a
            href={`tel:${d.company.phone.replace(/\s/g, '')}`}
            className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-control border border-line-strong bg-surface-2 text-[18px] font-semibold"
          >
            <Phone size={20} aria-hidden />
            {t('callOwner')}
          </a>
        ) : (
          <p className="text-ink-2">{t('noPhone')}</p>
        )}
      </Card>
    </Frame>
  )
}
