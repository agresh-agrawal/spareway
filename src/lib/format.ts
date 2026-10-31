// Display formats (Design System section 10). Latin digits in both languages, IST, ₹ en-IN.
import type { Lang } from '@/types/domain'
import { cmToFt } from './units'

const IST = 'Asia/Kolkata'

const inrFmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })
const num1 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1, minimumFractionDigits: 1 })
const num0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })

/** 124500 → "₹1,24,500" (negative → "−₹1,200") */
export function formatInr(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  const r = Math.round(value)
  return (r < 0 ? '−₹' : '₹') + inrFmt.format(Math.abs(r))
}

export function formatNumber(value: number): string {
  return num0.format(Math.round(value))
}

/** 1412.3 → "1,412 km" */
export function formatKm(km: number): string {
  return `${num0.format(Math.round(km))} km`
}

/** kg below 10,000; tonnes (1 decimal, trailing .0 dropped) from 10,000 */
export function formatWeight(kg: number): string {
  if (Math.abs(kg) >= 10_000) {
    const t = Math.round(kg / 100) / 10
    return `${Number.isInteger(t) ? num0.format(t) : num1.format(t)} t`
  }
  return `${num0.format(Math.round(kg))} kg`
}

/** 975 → "32.0 ft" */
export function formatFt(cm: number): string {
  return `${num1.format(cmToFt(cm))} ft`
}

/** 975 × 243 × 243 → "32.0 ft × 8.0 ft × 8.0 ft" */
export function formatTruckSize(l: number, w: number, h: number): string {
  return [l, w, h].map(formatFt).join(' × ')
}

/** 95 × 32 × 38 → "95 × 32 × 38 cm" */
export function formatCargoSize(l: number, w: number, h: number): string {
  return `${[l, w, h].map((v) => num0.format(Math.round(v))).join(' × ')} cm`
}

/** whole-number percent */
export function formatPct(pct: number | null | undefined): string {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return '—'
  return `${Math.round(pct)}%`
}

/** 1600 min → "26 h 40 min" / "26 घं 40 मि" */
export function formatDuration(minutes: number, lang: Lang = 'en'): string {
  const total = Math.max(0, Math.round(minutes))
  const h = Math.floor(total / 60)
  const m = total % 60
  const [hu, mu] = lang === 'hi' ? ['घं', 'मि'] : ['h', 'min']
  if (h === 0) return `${m} ${mu}`
  if (m === 0) return `${h} ${hu}`
  return `${h} ${hu} ${m} ${mu}`
}

const HI_MONTHS = ['जन', 'फ़र', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुला', 'अग', 'सितं', 'अक्टू', 'नवं', 'दिसं']
const HI_DAYS = ['रवि', 'सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि']

function istParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return {
    day: Number(get('day')),
    month: Number(get('month')) - 1,
    year: Number(get('year')),
    hour: Number(get('hour')),
    minute: get('minute'),
    weekday: get('weekday'),
  }
}

const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const EN_DAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

function toDate(value: string | number | Date): Date {
  return value instanceof Date ? value : new Date(value)
}

/** "6:00 pm" / "6:00 शाम" style in IST — Hindi keeps am/pm words simple */
export function formatTime(value: string | number | Date, lang: Lang = 'en'): string {
  const p = istParts(toDate(value))
  const h12 = p.hour % 12 === 0 ? 12 : p.hour % 12
  if (lang === 'hi') {
    const part = p.hour < 4 ? 'रात' : p.hour < 12 ? 'सुबह' : p.hour < 16 ? 'दोपहर' : p.hour < 20 ? 'शाम' : 'रात'
    return `${part} ${h12}:${p.minute}`
  }
  return `${h12}:${p.minute} ${p.hour < 12 ? 'am' : 'pm'}`
}

/** "30 Oct" */
export function formatDate(value: string | number | Date, lang: Lang = 'en'): string {
  const p = istParts(toDate(value))
  return `${p.day} ${lang === 'hi' ? HI_MONTHS[p.month] : EN_MONTHS[p.month]}`
}

/** "30 Oct, 6:00 pm" */
export function formatDateTime(value: string | number | Date, lang: Lang = 'en'): string {
  return `${formatDate(value, lang)}, ${formatTime(value, lang)}`
}

/** "Fri 6:00 pm" */
export function formatDayTime(value: string | number | Date, lang: Lang = 'en'): string {
  const p = istParts(toDate(value))
  const day = lang === 'hi' ? HI_DAYS[EN_DAYS[p.weekday] ?? 0] : p.weekday
  return `${day} ${formatTime(value, lang)}`
}

/** Long date for the greeting: "Thursday, 29 October" */
export function formatLongDate(value: string | number | Date, lang: Lang = 'en'): string {
  return new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN-u-nu-latn' : 'en-IN', {
    timeZone: IST,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(toDate(value))
}

/** Hour of day in IST (for the greeting) */
export function istHour(value: string | number | Date = new Date()): number {
  return istParts(toDate(value)).hour
}

/** "5 min ago" / "5 मिनट पहले" */
export function formatRelative(value: string | number | Date, lang: Lang = 'en', now: Date = new Date()): string {
  const diffMin = Math.round((now.getTime() - toDate(value).getTime()) / 60_000)
  const future = diffMin < 0
  const m = Math.abs(diffMin)
  const hi = lang === 'hi'
  if (m < 1) return hi ? 'अभी' : 'just now'
  let n: number
  let unit: string
  if (m < 60) {
    n = m
    unit = hi ? 'मिनट' : 'min'
  } else if (m < 60 * 24) {
    n = Math.round(m / 60)
    unit = hi ? 'घंटे' : n === 1 ? 'hour' : 'hours'
  } else {
    n = Math.round(m / (60 * 24))
    unit = hi ? (n === 1 ? 'दिन' : 'दिन') : n === 1 ? 'day' : 'days'
  }
  if (hi) return `${n} ${unit} ${future ? 'में' : 'पहले'}`
  return future ? `in ${n} ${unit}` : `${n} ${unit} ago`
}
