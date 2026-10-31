// planSchedule (Architecture F16): drive along the route from the departure time; break every
// break_after_drive_h at a dhaba / parking within 3 km ahead, overnight rest after max_drive_h_per_day,
// checkpoint delays, and wait out no-entry hours before entering a city. Pure and deterministic.
import { kmBetween } from '@/lib/geo'
import type { GeoLineString, Halt, Schedule } from '@/types/domain'
import { firstEntry, makeLine, pointAt, project, type Line, type LngLat } from './line'
import { noEntryRule, poiLngLat, REST_KINDS, tollRate, waitForWindows, type PoiInput } from './pois'

export interface ScheduleStop {
  id: string
  seq: number
  stop_type: string
  name: string
  city: string
  lat: number
  lng: number
  window_end?: string | null
}

export interface ScheduleSettings {
  break_after_drive_h: number
  break_min: number
  max_drive_h_per_day: number
  overnight_rest_h: number
  avg_speed_kmph: number
  checkpoint_delay_min: number
}

export interface RouteGeometryInput {
  distanceKm: number
  durationMin: number
  geometry: GeoLineString
}

export type RouteWarning =
  | { code: 'NO_ENTRY'; message: string; city: string; stopId: string; arriveAt: string; from: number; until: number; waitMin: number }
  | { code: 'LATE'; message: string; stopId: string; stop: string; eta: string; by: string }

export interface TollHit {
  poiId: string
  name: string
  km: number
  rateInr: number
  lat: number
  lng: number
}

export interface RoutePlan {
  schedule: Omit<Schedule, 'warnings'> & { warnings: RouteWarning[] }
  departure: string
  /** driving only */
  driveMin: number
  /** departure → last stop, everything included */
  totalMin: number
  /** no-entry waits */
  waitMin: number
  checkpointMin: number
  tolls: TollHit[]
  checkpointCount: number
  breakCount: number
  overnightCount: number
}

const TOLL_KM = 0.5
const CHECKPOINT_KM = 1
const REST_AHEAD_KM = 3
const REST_OFF_ROUTE_KM = 3
const IST_OFFSET_MIN = 330
const OVERNIGHT_MERGE_MIN = 60

/** Minute of the day in India time. */
export function istMinuteOfDay(ms: number): number {
  return Math.floor((((ms / 60000 + IST_OFFSET_MIN) % 1440) + 1440) % 1440)
}

const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

/** Does a corridor rule ("Gujarat_to_Thane_Bhiwandi_Kalyan", area text) name this stop's town? */
function ruleNamesStop(text: string, stop: ScheduleStop): boolean {
  const hay = text.toLowerCase().replace(/[_()]/g, ' ')
  const words = `${stop.city} ${stop.name}`
    .toLowerCase()
    .replace(/[()]/g, ' ')
    .split(/[\s,]+/)
    .filter((w) => w.length >= 4)
  return words.some((w) => new RegExp(`\\b${w.replace(/[.*+?^${}|[\]\\]/g, '\\$&')}\\b`).test(hay))
}

type Event =
  | { kind: 'stop'; km: number; stop: ScheduleStop }
  | { kind: 'checkpoint'; km: number; poi: PoiInput }
  | { kind: 'zone'; km: number; poi: PoiInput; windows: [number, number][]; stop: ScheduleStop }

const ORDER: Record<Event['kind'], number> = { checkpoint: 0, zone: 1, stop: 2 }

/** Tolls within 0.5 km of the route, each once, at the truck's axle rate. */
export function tollsOnRoute(line: Line, scale: number, pois: PoiInput[], axles: number): TollHit[] {
  const out: TollHit[] = []
  for (const p of pois) {
    if (p.kind !== 'toll') continue
    const pr = project(line, poiLngLat(p))
    if (pr.offKm > TOLL_KM) continue
    if (out.some((t) => kmBetween(t.lat, t.lng, p.lat, p.lng) < 0.05)) continue
    out.push({ poiId: p.id, name: p.name, km: pr.km * scale, rateInr: tollRate(p, axles), lat: p.lat, lng: p.lng })
  }
  return out.sort((a, b) => a.km - b.km)
}

export function planSchedule(
  route: RouteGeometryInput,
  stopsIn: ScheduleStop[],
  pois: PoiInput[],
  settings: ScheduleSettings,
  departure: string,
  axles = 2,
): RoutePlan {
  const line = makeLine(route.geometry.coordinates as LngLat[])
  const scale = line.lengthKm > 0 && route.distanceKm > 0 ? route.distanceKm / line.lengthKm : 1
  const geomKm = (km: number) => km / scale
  const avg = settings.avg_speed_kmph > 0 ? settings.avg_speed_kmph : 45
  // driving time: the route's own duration, but never faster than the company's average speed
  const driveTotal = Math.max(route.durationMin, (route.distanceKm / avg) * 60)
  const minPerKm = route.distanceKm > 0 ? driveTotal / route.distanceKm : 0
  const depMs = new Date(departure).getTime()
  const iso = (min: number) => new Date(depMs + min * 60000).toISOString()

  // stops in order, each matched on the line after the previous one
  const stops = [...stopsIn].sort((a, b) => a.seq - b.seq)
  const stopKm = new Map<string, { km: number; segment: number }>()
  let seg = 0
  for (const s of stops) {
    if (s.seq === 0) {
      stopKm.set(s.id, { km: 0, segment: 0 })
      continue
    }
    const pr = project(line, [s.lng, s.lat], seg)
    seg = pr.segment
    stopKm.set(s.id, { km: pr.km * scale, segment: pr.segment })
  }

  const events: Event[] = []
  for (const s of stops) if (s.seq > 0) events.push({ kind: 'stop', km: stopKm.get(s.id)!.km, stop: s })

  let checkpointCount = 0
  for (const p of pois) {
    if (p.kind !== 'checkpoint') continue
    const pr = project(line, poiLngLat(p))
    if (pr.offKm <= CHECKPOINT_KM) {
      events.push({ kind: 'checkpoint', km: pr.km * scale, poi: p })
      checkpointCount++
    }
  }

  // no-entry: stop inside the city's circle, or the route passes a corridor zone whose rule names the stop's town
  const zones = pois.filter((p) => p.kind === 'city_entry').map((p) => ({ poi: p, rule: noEntryRule(p) }))
  const usedZones = new Set<string>()
  for (let i = 1; i < stops.length; i++) {
    const s = stops[i]
    const prevKm = stopKm.get(stops[i - 1].id)!.km
    const sKm = stopKm.get(s.id)!.km
    for (const { poi, rule } of zones) {
      if (!rule || usedZones.has(poi.id)) continue
      const inside = kmBetween(s.lat, s.lng, poi.lat, poi.lng) <= rule.radiusKm
      const isCity = rule.direction === 'city_entry'
      const named = !isCity && ruleNamesStop(`${rule.direction} ${rule.area}`, s)
      if (!(isCity ? inside : named)) continue
      const entry = firstEntry(line, poiLngLat(poi), rule.radiusKm, geomKm(prevKm), geomKm(sKm) + 0.01)
      if (entry === null) continue
      // already inside when leaving the previous stop (e.g. starting in that city) → nothing to wait for
      if (entry * scale <= prevKm + 0.01 && i === 1) continue
      usedZones.add(poi.id)
      events.push({ kind: 'zone', km: Math.min(entry * scale, sKm), poi, windows: rule.windows, stop: s })
    }
  }
  events.sort((a, b) => a.km - b.km || ORDER[a.kind] - ORDER[b.kind])

  const rest = pois
    .filter((p) => REST_KINDS.has(p.kind))
    .map((p) => ({ p, pr: project(line, poiLngLat(p)) }))
    .filter((x) => x.pr.offKm <= REST_OFF_ROUTE_KM)
    .map((x) => ({ p: x.p, km: x.pr.km * scale }))
    .sort((a, b) => a.km - b.km)

  const halts: Halt[] = []
  const stopEtas: Schedule['stopEtas'] = []
  const warnings: RouteWarning[] = []
  let clock = 0
  let sinceBreak = 0
  let today = 0
  let pos = 0
  let driveMin = 0
  let waitMin = 0
  let checkpointMin = 0
  const breakAfter = Math.max(30, settings.break_after_drive_h * 60)
  const dayMax = Math.max(breakAfter, settings.max_drive_h_per_day * 60)

  const drive = (km: number) => {
    const dt = (km - pos) * minPerKm
    clock += dt
    sinceBreak += dt
    today += dt
    driveMin += dt
    pos = km
  }

  const driveTo = (target: number) => {
    for (let guard = 0; pos < target - 1e-6 && guard < 1000; guard++) {
      const need = (target - pos) * minPerKm
      const limit = Math.min(breakAfter - sinceBreak, dayMax - today)
      if (need <= limit + 1e-9) {
        drive(target)
        return
      }
      const due = pos + Math.max(0, limit) / minPerKm
      // overnight due anyway within the hour → take the night's rest now instead of a short break first
      const overnight = dayMax - today <= breakAfter - sinceBreak + OVERNIGHT_MERGE_MIN
      const spot = rest.find((r) => r.km >= due - 1e-6 && r.km <= Math.min(due + REST_AHEAD_KM, target))
      drive(spot ? spot.km : due)
      const [lng, lat] = spot ? poiLngLat(spot.p) : pointAt(line, geomKm(pos))
      const durationMin = overnight ? Math.round(settings.overnight_rest_h * 60) : settings.break_min
      halts.push({
        kind: overnight ? 'overnight' : 'break',
        name: spot?.p.name ?? '',
        lat,
        lng,
        atMin: Math.round(clock),
        durationMin,
        ...(spot ? { poiId: spot.p.id } : {}),
      })
      clock += durationMin
      sinceBreak = 0
      if (overnight) today = 0
    }
  }

  for (const e of events) {
    driveTo(e.km)
    if (e.kind === 'checkpoint') {
      const d = settings.checkpoint_delay_min
      halts.push({ kind: 'checkpoint', name: e.poi.name, lat: e.poi.lat, lng: e.poi.lng, atMin: Math.round(clock), durationMin: d, poiId: e.poi.id })
      clock += d
      checkpointMin += d
    } else if (e.kind === 'zone') {
      clock = Math.ceil(clock - 1e-9) // whole minutes, so the wait ends exactly when the window does
      const tod = istMinuteOfDay(depMs + clock * 60000)
      const { waitMin: w, until } = waitForWindows(e.windows, tod)
      if (w > 0) {
        const [lng, lat] = pointAt(line, geomKm(e.km))
        const city = e.poi.city || e.poi.name
        halts.push({ kind: 'no_entry_wait', name: city, lat, lng, atMin: Math.round(clock), durationMin: w, poiId: e.poi.id })
        warnings.push({
          code: 'NO_ENTRY',
          message: `Reaches ${city} at ${hhmm(tod)} — no entry until ${hhmm(until)}, wait ${Math.floor(w / 60)} h ${w % 60} min`,
          city,
          stopId: e.stop.id,
          arriveAt: iso(clock),
          from: tod,
          until,
          waitMin: w,
        })
        clock += w
        waitMin += w
        if (w >= settings.break_min) sinceBreak = 0
        if (w >= settings.overnight_rest_h * 60) today = 0
      }
    } else {
      const eta = iso(clock)
      stopEtas.push({ stopId: e.stop.id, eta })
      if (e.stop.window_end && new Date(eta).getTime() > new Date(e.stop.window_end).getTime())
        warnings.push({
          code: 'LATE',
          message: `Reaches ${e.stop.name} after the delivery time`,
          stopId: e.stop.id,
          stop: e.stop.name,
          eta,
          by: e.stop.window_end,
        })
    }
  }

  const tolls = tollsOnRoute(line, scale, pois, axles)
  return {
    schedule: { halts, stopEtas, warnings },
    departure: new Date(depMs).toISOString(),
    driveMin: Math.round(driveMin),
    totalMin: Math.round(clock),
    waitMin: Math.round(waitMin),
    checkpointMin,
    tolls,
    checkpointCount,
    breakCount: halts.filter((h) => h.kind === 'break').length,
    overnightCount: halts.filter((h) => h.kind === 'overnight').length,
  }
}
