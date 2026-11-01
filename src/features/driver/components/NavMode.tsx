// Spareway drive view (driver link): our own live map instead of only Google Maps. It follows the phone's GPS on
// the owner's planned truck route (truck-safe, no-entry hours and tolls already worked out), turns the map with
// the truck, shows the next turn from the route shape, km and arrival time to the next stop, speed against the
// truck limit, tolls / breaks ahead, warns when off the route, speaks in Hindi or English, keeps the screen on and
// shares the position with the owner while open. "Demo drive" moves along the route without GPS (Simulated).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import MapGL, { AttributionControl, Layer, Marker, Source, type MapRef } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import {
  ArrowUp,
  CircleAlert,
  Coffee,
  CornerUpLeft,
  CornerUpRight,
  Crosshair,
  Map as MapIcon,
  MapPinCheck,
  Moon,
  Navigation,
  ShieldAlert,
  Undo2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { applyLabelLang, useMapStyleUrl } from '@/components/common/MapView'
import { stopColor } from '@/components/common'
import { boundsOf, type LngLat } from '@/lib/geo'
import { useLang } from '@/lib/i18n'
import { formatDuration } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Halt } from '@/types/domain'
import type { DriverStop, DriverTrip } from '../api'
import { sendDriverLocation } from '../api'
import {
  distanceWords,
  indexRoute,
  isOffRoute,
  minutesFor,
  pointAt,
  snap,
  splitAt,
  TRUCK_LIMIT_KMPH,
  turnsAhead,
  type TurnDir,
} from '../lib/nav'

interface Fix {
  p: LngLat
  accuracyM: number
  speedKmph: number | null
  heading: number | null
  at: number
}

const TURN_ICON: Record<TurnDir | 'straight', typeof ArrowUp> = {
  left: CornerUpLeft,
  slightLeft: CornerUpLeft,
  sharpLeft: CornerUpLeft,
  right: CornerUpRight,
  slightRight: CornerUpRight,
  sharpRight: CornerUpRight,
  uturn: Undo2,
  straight: ArrowUp,
}
const HALT_ICON: Record<Halt['kind'], typeof Coffee> = { break: Coffee, overnight: Moon, no_entry_wait: ShieldAlert, checkpoint: ShieldAlert }
const SEND_EVERY_MS = 30_000
const DEMO_KMPH = 55
const DEMO_SPEED_UP = 20

function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on || !('wakeLock' in navigator)) return
    let lock: { release: () => Promise<void> } | null = null
    const get = () =>
      (navigator as Navigator & { wakeLock: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock
        .request('screen')
        .then((l) => (lock = l))
        .catch(() => undefined)
    void get()
    const again = () => document.visibilityState === 'visible' && void get()
    document.addEventListener('visibilitychange', again)
    return () => {
      document.removeEventListener('visibilitychange', again)
      void lock?.release().catch(() => undefined)
    }
  }, [on])
}

export default function NavMode({
  token,
  data,
  onClose,
  onArrived,
}: {
  token: string
  data: DriverTrip
  onClose: () => void
  onArrived: (stop: DriverStop) => void
}) {
  const { t, td, lang } = useLang('driver')
  const styleUrl = useMapStyleUrl()
  const map = useRef<MapRef>(null)
  const [started, setStarted] = useState<'gps' | 'demo' | null>(null)
  const [fix, setFix] = useState<Fix | null>(null)
  const [gpsError, setGpsError] = useState<'denied' | 'unavailable' | null>(null)
  const [follow, setFollow] = useState(true)
  const [voice, setVoice] = useState(() => 'speechSynthesis' in window)
  const offHistory = useRef<number[]>([])
  const lastKm = useRef<number | null>(null)
  const lastSent = useRef(0)
  const spoken = useRef(new Set<string>())
  const overspeedAt = useRef(0)
  useWakeLock(started !== null)

  // the planned truck route; without one, a straight line through the stops
  const route = useMemo(() => {
    const coords = (data.route?.geometry?.coordinates as LngLat[] | undefined) ?? data.stops.map((s) => [s.lng, s.lat] as LngLat)
    return indexRoute(coords)
  }, [data])
  const avgKmph = data.route && data.route.durationMin > 0 ? (60 * data.route.distanceKm) / data.route.durationMin : 45
  const stopKm = useMemo(() => new Map(data.stops.map((s) => [s.id, snap(route, [s.lng, s.lat]).km])), [data.stops, route])
  const halts = useMemo(
    () => (data.route?.halts ?? []).map((h) => ({ ...h, km: snap(route, [h.lng, h.lat]).km })).sort((a, b) => a.km - b.km),
    [data.route, route],
  )

  const say = useCallback(
    (text: string) => {
      if (!voice || !('speechSynthesis' in window)) return
      try {
        const u = new SpeechSynthesisUtterance(text)
        u.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'
        window.speechSynthesis.cancel()
        window.speechSynthesis.speak(u)
      } catch {
        /* no voice on this phone */
      }
    },
    [voice, lang],
  )

  // ---- position: phone GPS, or the demo drive along the route ----
  useEffect(() => {
    if (started !== 'gps') return
    if (!('geolocation' in navigator)) {
      setGpsError('unavailable')
      return
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsError(null)
        setFix({
          p: [pos.coords.longitude, pos.coords.latitude],
          accuracyM: pos.coords.accuracy,
          speedKmph: pos.coords.speed === null ? null : pos.coords.speed * 3.6,
          heading: pos.coords.heading === null || Number.isNaN(pos.coords.heading) ? null : pos.coords.heading,
          at: pos.timestamp,
        })
      },
      (err) => setGpsError(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [started])

  useEffect(() => {
    if (started !== 'demo') return
    let km = Math.max(0, lastKm.current ?? 0)
    const tick = setInterval(() => {
      km = Math.min(route.totalKm, km + (DEMO_KMPH * DEMO_SPEED_UP) / 3600)
      const p = pointAt(route.line, route.cum, km)
      setFix({ p, accuracyM: 5, speedKmph: DEMO_KMPH, heading: snap(route, p, km).bearing, at: Date.now() })
    }, 1000)
    return () => clearInterval(tick)
  }, [started, route])

  // ---- where we are on the route ----
  const here = useMemo(() => (fix ? snap(route, fix.p, lastKm.current) : null), [fix, route])
  useEffect(() => {
    if (!here || !fix) return
    lastKm.current = here.km
    offHistory.current = [...offHistory.current, here.offKm].slice(-5)
  }, [here, fix])
  const off = here && fix ? isOffRoute([...offHistory.current.slice(-2), here.offKm], fix.accuracyM) : false
  const km = here?.km ?? 0
  const pending = data.stops.filter((s) => s.type !== 'origin' && s.status !== 'done')
  const next = pending.find((s) => (stopKm.get(s.id) ?? 0) > km - 0.3) ?? pending[0] ?? null
  const toNextKm = next ? Math.max(0, (stopKm.get(next.id) ?? route.totalKm) - km) : 0
  const leftKm = Math.max(0, route.totalKm - km)
  const turns = turnsAhead(route, km)
  const turn = turns[0]
  const toTurnKm = turn ? turn.km - km : null
  const speed = fix?.speedKmph ?? null
  const fast = speed !== null && speed > TRUCK_LIMIT_KMPH + 2
  const nextHalt = halts.find((h) => h.km > km + 0.05 && h.km - km < 200)
  const arrived = Boolean(next && fix && toNextKm < 0.15)
  const etaMin = minutesFor(toNextKm, avgKmph)
  const etaClock = new Date(Date.now() + etaMin * 60_000).toLocaleTimeString(lang === 'hi' ? 'hi-IN' : 'en-IN', { hour: 'numeric', minute: '2-digit' })

  // ---- share with the owner (real GPS only) ----
  useEffect(() => {
    if (started !== 'gps' || !fix || Date.now() - lastSent.current < SEND_EVERY_MS) return
    lastSent.current = Date.now()
    void sendDriverLocation(token, fix.p[1], fix.p[0], Math.round(fix.accuracyM), speed === null ? null : Math.round(speed)).catch(() => undefined)
  }, [fix, started, token, speed])

  // ---- camera follows the truck, map turned to the direction of travel ----
  useEffect(() => {
    if (!fix || !follow || !here) return
    map.current?.easeTo({ center: fix.p, zoom: 16, pitch: 50, bearing: fix.heading ?? here.bearing, duration: 900 })
  }, [fix, follow, here])

  // ---- voice ----
  const turnText = (dir: TurnDir | 'straight', distKm: number | null) => {
    if (dir === 'straight' || distKm === null) return t('nav.straight', { dist: dw(leftKm < 20 ? leftKm : 20) })
    return t(`nav.turn.${dir}`, { dist: dw(distKm) })
  }
  const dw = (k: number) => {
    const d = distanceWords(k)
    return `${d.value} ${t(`nav.unit.${d.unit}`)}`
  }
  useEffect(() => {
    if (!turn || toTurnKm === null) return
    for (const at of [0.5, 0.1]) {
      const key = `${turn.km.toFixed(3)}@${at}`
      if (toTurnKm <= at && toTurnKm > 0.02 && !spoken.current.has(key)) {
        spoken.current.add(key)
        say(t(`nav.turn.${turn.dir}`, { dist: dw(Math.max(toTurnKm, 0.05)) }))
      }
    }
  })
  useEffect(() => {
    if (off && !spoken.current.has(`off@${Math.round(km)}`)) {
      spoken.current.add(`off@${Math.round(km)}`)
      say(t('nav.offSay'))
    }
  }, [off, km, say, t])
  useEffect(() => {
    if (fast && Date.now() - overspeedAt.current > 120_000) {
      overspeedAt.current = Date.now()
      say(t('nav.slowDownSay', { limit: TRUCK_LIMIT_KMPH }))
    }
  }, [fast, say, t])
  useEffect(() => {
    if (arrived && next && !spoken.current.has(`arr@${next.id}`)) {
      spoken.current.add(`arr@${next.id}`)
      say(t('nav.arrivedSay', { stop: td(next.name) }))
    }
  }, [arrived, next, say, t, td])

  const overview = () => {
    setFollow(false)
    const b = boundsOf(route.line)
    if (b) map.current?.fitBounds(b, { padding: 60, bearing: 0, pitch: 0, duration: 600 })
  }
  const split = splitAt(route, km)
  const lineFeature = (coords: LngLat[]) => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: coords } })
  const TurnIcon = TURN_ICON[turn ? turn.dir : 'straight']

  // ---- start screen: what it does + permission ----
  if (!started)
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-canvas">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-[20px] font-semibold">{t('nav.title')}</h2>
          <button type="button" onClick={onClose} aria-label={t('nav.exit')} className="flex size-12 items-center justify-center rounded-full bg-surface-2">
            <X size={24} />
          </button>
        </div>
        <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col gap-4 overflow-y-auto p-4">
          <p className="text-[19px] leading-7">{t('nav.intro')}</p>
          <ul className="flex flex-col gap-2 text-[17px] text-ink-2">
            {(['p1', 'p2', 'p3', 'p4'] as const).map((k) => (
              <li key={k} className="flex gap-2">
                <span className="mt-2 size-2 shrink-0 rounded-full bg-accent" aria-hidden />
                {t(`nav.points.${k}`)}
              </li>
            ))}
          </ul>
          <p className="rounded-tile border border-line bg-surface-2 p-3 text-ink-2">{t('nav.privacy', { company: data.company.name })}</p>
          <button
            type="button"
            onClick={() => setStarted('gps')}
            className="inline-flex h-16 w-full items-center justify-center gap-2 rounded-control bg-accent text-[20px] font-semibold text-accent-ink"
          >
            <Navigation size={24} aria-hidden />
            {t('nav.start')}
          </button>
          <button
            type="button"
            onClick={() => setStarted('demo')}
            className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-control border border-line-strong bg-surface-2 text-[18px] font-semibold"
          >
            {t('nav.demo')}
          </button>
        </div>
      </div>
    )

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0b0d0f]">
      {/* next instruction */}
      <div className={cn('z-10 flex items-center gap-3 px-4 py-3 text-white', off ? 'bg-crit' : 'bg-[#1f3d14]')}>
        {off ? <CircleAlert size={44} aria-hidden /> : <TurnIcon size={44} aria-hidden />}
        <div className="min-w-0 flex-1">
          <div className="text-[24px] leading-8 font-bold">
            {off ? t('nav.off', { dist: dw(here?.offKm ?? 0) }) : arrived && next ? t('nav.arrived', { stop: td(next.name) }) : turnText(turn?.dir ?? 'straight', toTurnKm)}
          </div>
          {!off && turns[1] && toTurnKm !== null && turns[1].km - turn!.km < 1 && (
            <div className="text-[16px] opacity-85">{t('nav.then', { what: t(`nav.dir.${turns[1].dir}`) })}</div>
          )}
          {started === 'demo' && <div className="text-[14px] font-semibold opacity-85">{t('nav.simulated')}</div>}
        </div>
      </div>

      <div className="relative flex-1">
        <MapGL
          ref={map}
          mapStyle={styleUrl}
          initialViewState={{ bounds: boundsOf(route.line) ?? undefined, fitBoundsOptions: { padding: 60 } }}
          attributionControl={false}
          maxPitch={60}
          onLoad={() => {
            const m = map.current?.getMap()
            if (m) applyLabelLang(m, lang)
          }}
          onStyleData={(e) => e.target.isStyleLoaded() && applyLabelLang(e.target, lang)}
          onDragStart={() => setFollow(false)}
          style={{ width: '100%', height: '100%' }}
        >
          <AttributionControl compact position="bottom-left" />
          {split.done.length > 1 && (
            <Source id="nav-done" type="geojson" data={lineFeature(split.done)}>
              <Layer id="nav-done-line" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': '#7c8173', 'line-width': 7, 'line-opacity': 0.8 }} />
            </Source>
          )}
          {split.ahead.length > 1 && (
            <Source id="nav-ahead" type="geojson" data={lineFeature(split.ahead)}>
              <Layer id="nav-ahead-casing" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': '#1f3d14', 'line-width': 12 }} />
              <Layer id="nav-ahead-line" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': '#b8e05a', 'line-width': 7 }} />
            </Source>
          )}
          {off && fix && here && (
            <Source id="nav-rejoin" type="geojson" data={lineFeature([fix.p, here.point])}>
              <Layer id="nav-rejoin-line" type="line" paint={{ 'line-color': '#ff6b5b', 'line-width': 4, 'line-dasharray': [2, 2] }} />
            </Source>
          )}
          {data.stops.map((s) => (
            <Marker key={s.id} longitude={s.lng} latitude={s.lat} anchor="center">
              <span
                className="flex size-8 items-center justify-center rounded-full border-2 border-white text-[13px] font-bold text-black shadow-lg"
                style={{ background: s.status === 'done' ? '#9aa091' : stopColor(s.seq) }}
                title={s.name}
              >
                {s.seq}
              </span>
            </Marker>
          ))}
          {halts.map((h, i) => {
            const Icon = HALT_ICON[h.kind]
            return (
              <Marker key={`h${i}`} longitude={h.lng} latitude={h.lat} anchor="center">
                <span className="flex size-7 items-center justify-center rounded-full border border-white bg-[#2a2f24] text-white shadow" title={h.name}>
                  <Icon size={15} aria-hidden />
                </span>
              </Marker>
            )
          })}
          {fix && (
            <Marker longitude={fix.p[0]} latitude={fix.p[1]} anchor="center" rotation={fix.heading ?? here?.bearing ?? 0} rotationAlignment="map" pitchAlignment="map">
              <span className="flex size-12 items-center justify-center rounded-full border-4 border-white bg-[#2b7de9] text-white shadow-xl" aria-label={t('nav.you')}>
                <Navigation size={24} fill="currentColor" aria-hidden />
              </span>
            </Marker>
          )}
        </MapGL>

        {/* speed against the truck limit */}
        <div
          className={cn(
            'absolute top-3 left-3 flex size-20 flex-col items-center justify-center rounded-full border-4 bg-white text-black shadow-lg',
            fast ? 'border-crit animate-pulse' : 'border-[#d0d4c8]',
          )}
          aria-label={t('nav.speed')}
        >
          <span className="text-[26px] leading-7 font-bold tabular">{speed === null ? '–' : Math.round(speed)}</span>
          <span className="text-[11px] font-semibold">km/h</span>
        </div>
        {fast && (
          <div className="absolute top-24 left-3 rounded-full bg-crit px-3 py-1 text-[15px] font-semibold text-white">
            {t('nav.slowDown', { limit: TRUCK_LIMIT_KMPH })}
          </div>
        )}

        <div className="absolute top-3 right-3 flex flex-col gap-2">
          <button type="button" onClick={onClose} aria-label={t('nav.exit')} className="flex size-12 items-center justify-center rounded-full bg-white text-black shadow-lg">
            <X size={24} />
          </button>
          <button type="button" onClick={() => setVoice((v) => !v)} aria-label={voice ? t('nav.mute') : t('nav.unmute')} className="flex size-12 items-center justify-center rounded-full bg-white text-black shadow-lg">
            {voice ? <Volume2 size={22} /> : <VolumeX size={22} />}
          </button>
          <button type="button" onClick={overview} aria-label={t('nav.overview')} className="flex size-12 items-center justify-center rounded-full bg-white text-black shadow-lg">
            <MapIcon size={22} />
          </button>
        </div>
        {!follow && fix && (
          <button
            type="button"
            onClick={() => setFollow(true)}
            className="absolute bottom-4 left-1/2 inline-flex h-12 -translate-x-1/2 items-center gap-2 rounded-full bg-white px-5 font-semibold text-black shadow-lg"
          >
            <Crosshair size={20} aria-hidden />
            {t('nav.recentre')}
          </button>
        )}
        {gpsError && (
          <div className="absolute inset-x-3 bottom-4 rounded-tile bg-crit p-3 text-[16px] text-white">
            {t(`nav.gps.${gpsError}`)}{' '}
            <button type="button" className="font-bold underline" onClick={() => setStarted('demo')}>
              {t('nav.demo')}
            </button>
          </div>
        )}
        {!fix && !gpsError && (
          <div className="absolute inset-x-0 bottom-4 mx-auto w-fit rounded-full bg-white px-4 py-2 font-semibold text-black shadow">{t('nav.waiting')}</div>
        )}
      </div>

      {/* what is left */}
      <div className="safe-bottom z-10 border-t border-line bg-surface px-4 pt-3 pb-3">
        {next ? (
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-label text-ink-2">{t('nav.to', { stop: td(next.name) })}</div>
              <div className="text-[28px] leading-8 font-bold tabular">
                {etaClock} <span className="text-[18px] font-semibold text-ink-2">· {formatDuration(etaMin, lang)}</span>
              </div>
              <div className="text-[17px] text-ink-2 tabular">
                {dw(toNextKm)} · {t('nav.total', { dist: dw(leftKm) })}
              </div>
            </div>
            {arrived && (
              <button
                type="button"
                onClick={() => onArrived(next)}
                className="inline-flex h-14 shrink-0 items-center gap-2 rounded-control bg-accent px-4 text-[18px] font-semibold text-accent-ink"
              >
                <MapPinCheck size={22} aria-hidden />
                {t('reached')}
              </button>
            )}
          </div>
        ) : (
          <div className="text-[20px] font-semibold">{t('allDelivered')}</div>
        )}
        {nextHalt && (
          <div className="mt-2 flex items-center gap-2 rounded-tile bg-surface-2 px-3 py-2 text-[16px]">
            {(() => {
              const Icon = HALT_ICON[nextHalt.kind]
              return <Icon size={18} className="shrink-0 text-ink-2" aria-hidden />
            })()}
            <span className="min-w-0 flex-1 truncate">
              {t(`nav.halt.${nextHalt.kind}`)} · {td(nextHalt.name)}
            </span>
            <span className="shrink-0 font-semibold tabular">{dw(nextHalt.km - km)}</span>
          </div>
        )}
        {fix && started === 'gps' && <div className="mt-1 text-[12px] text-ink-3">{t('nav.sharing', { m: Math.round(fix.accuracyM) })}</div>}
      </div>
    </div>
  )
}
