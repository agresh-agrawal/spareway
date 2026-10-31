// Journey list + driver WhatsApp message from a planned route. Pure: the translate function and language are
// passed in, so the driver message can be Hindi while the screen is English.
import { formatDateTime, formatDayTime, formatDuration, formatInr, formatKm } from '@/lib/format'
import { td } from '@/lib/i18n'
import i18n from '@/i18n/setup'
import type { Halt, Lang } from '@/types/domain'
import type { RoutePlan, RouteWarning, ScheduleStop } from './schedule'

export type JourneyItem =
  | { kind: 'start'; at: string; stop: ScheduleStop }
  | { kind: 'stop'; at: string; stop: ScheduleStop }
  | { kind: Halt['kind']; at: string; halt: Halt }

export function journeyItems(plan: RoutePlan, stops: ScheduleStop[]): JourneyItem[] {
  const dep = Date.parse(plan.departure)
  const origin = stops.find((s) => s.seq === 0)
  const items: (JourneyItem & { ms: number; order: number })[] = []
  if (origin) items.push({ kind: 'start', at: plan.departure, stop: origin, ms: dep, order: 0 })
  for (const e of plan.schedule.stopEtas) {
    const stop = stops.find((s) => s.id === e.stopId)
    if (stop) items.push({ kind: 'stop', at: e.eta, stop, ms: Date.parse(e.eta), order: 2 })
  }
  for (const h of plan.schedule.halts) {
    const ms = dep + h.atMin * 60000
    items.push({ kind: h.kind, at: new Date(ms).toISOString(), halt: h, ms, order: 1 })
  }
  return items.sort((a, b) => a.ms - b.ms || a.order - b.order).map(({ ms: _ms, order: _o, ...rest }) => rest as JourneyItem)
}

type T = (key: string, values?: Record<string, unknown>) => string

/** Place names: the demo dictionary first, then this feature's names for no-entry towns (POI data). */
export function placeName(name: string, lang: Lang): string {
  const viaTd = td(name, lang)
  if (viaTd !== name || lang !== 'hi') return viaTd
  const places = i18n.getResource(lang, 'routes', 'places') as Record<string, string> | undefined
  return places?.[name] ?? name
}

const hhmmToTime = (min: number, lang: Lang) => {
  const h = Math.floor(min / 60) % 24
  const m = min % 60
  const h12 = h % 12 === 0 ? 12 : h % 12
  const ampm = lang === 'hi' ? (h < 12 ? 'सुबह' : h < 17 ? 'दोपहर' : 'शाम') : h < 12 ? 'am' : 'pm'
  const time = `${h12}:${String(m).padStart(2, '0')}`
  return lang === 'hi' ? `${ampm} ${time}` : `${time} ${ampm}`
}

/** Plain warning line ("Reaches Mira-Bhayandar at 6:31 pm — no entry until 9:00 pm, wait 2 h 29 min"). */
export function warningText(w: RouteWarning, t: T, lang: Lang): string {
  if (w.code === 'NO_ENTRY')
    return t('warning.noEntry', {
      city: placeName(w.city, lang),
      at: hhmmToTime(w.from, lang),
      until: hhmmToTime(w.until, lang),
      wait: formatDuration(w.waitMin, lang),
    })
  return t('warning.late', { stop: td(w.stop, lang), at: formatDayTime(w.eta, lang), by: formatDayTime(w.by, lang) })
}

/** Label for one journey row. */
export function journeyLabel(item: JourneyItem, t: T, lang: Lang): string {
  switch (item.kind) {
    case 'start':
      return t('journey.start', { place: td(item.stop.name, lang) })
    case 'stop':
      return t('journey.stop', { place: td(item.stop.name, lang) })
    case 'break':
      return item.halt.name ? t('journey.breakAt', { place: item.halt.name, dur: formatDuration(item.halt.durationMin, lang) }) : t('journey.break', { dur: formatDuration(item.halt.durationMin, lang) })
    case 'overnight':
      return item.halt.name ? t('journey.overnightAt', { place: item.halt.name, dur: formatDuration(item.halt.durationMin, lang) }) : t('journey.overnight', { dur: formatDuration(item.halt.durationMin, lang) })
    case 'no_entry_wait':
      return t('journey.wait', { city: placeName(item.halt.name, lang), dur: formatDuration(item.halt.durationMin, lang) })
    case 'checkpoint':
      return t('journey.checkpoint', { place: item.halt.name, dur: formatDuration(item.halt.durationMin, lang) })
  }
}

export interface DriverMessageInput {
  code: string
  regNo: string
  driverName: string
  variantLabel: string
  distanceKm: number
  tollsInr: number
  tollCount: number
  plan: RoutePlan
  stops: ScheduleStop[]
}

/** The WhatsApp text for the driver, in `lang`. */
export function driverMessage(input: DriverMessageInput, t: T, lang: Lang): string {
  const { plan } = input
  const lines = [
    t('message.title', { code: input.code, reg: input.regNo }),
    input.driverName ? t('message.hello', { name: td(input.driverName, lang) }) : '',
    t('message.leave', { at: formatDateTime(plan.departure, lang) }),
    t('message.route', { name: input.variantLabel, km: formatKm(input.distanceKm), time: formatDuration(plan.totalMin, lang) }),
    '',
  ]
  for (const item of journeyItems(plan, input.stops)) {
    if (item.kind === 'start') continue
    lines.push(`${formatDayTime(item.at, lang)} — ${journeyLabel(item, t, lang)}`)
  }
  lines.push('', t('message.tolls', { count: input.tollCount, inr: formatInr(input.tollsInr) }), t('message.safe'))
  return lines.filter((l, i, arr) => !(l === '' && (i === 0 || arr[i - 1] === ''))).join('\n').trim()
}

/** wa.me link: to the driver's number when we have one, else WhatsApp asks who to send it to. */
export function whatsappLink(phone: string | null | undefined, text: string): string {
  const digits = (phone ?? '').replace(/\D/g, '')
  const to = digits.length === 10 ? `91${digits}` : digits
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`
}
