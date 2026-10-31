// Load provider form rules and the offer calculator (stages 5 and 6). Pure.
import { z } from 'zod'
import { kmBetween } from '@/lib/geo'

const num = (min: number, max: number, msg: string) =>
  z.coerce.number({ message: msg }).min(min, msg).max(max, msg)
const req = 'provider:err.required'

/** One load as the provider types it (form strings → numbers). Messages are i18n keys. */
export const loadFormSchema = z
  .object({
    goods: z.string().trim().min(1, req).max(60, req),
    from: z.string().min(1, 'provider:err.from'),
    to: z.string().min(1, 'provider:err.to'),
    lengthCm: num(5, 1500, 'provider:err.size'),
    widthCm: num(5, 1500, 'provider:err.size'),
    heightCm: num(5, 1500, 'provider:err.size'),
    weightKg: num(0.1, 40000, 'provider:err.weight'),
    quantity: z.coerce
      .number({ message: 'provider:err.qty' })
      .int('provider:err.qty')
      .min(1, 'provider:err.qty')
      .max(1000, 'provider:err.qty'),
    fragile: z.boolean(),
    priceInr: num(1, 10_000_000, 'provider:err.price'),
    readyFrom: z.string(),
    deliverBy: z.string(),
    note: z.string().max(200),
  })
  .refine((v) => v.from !== v.to, { message: 'provider:err.same', path: ['to'] })
  .refine((v) => !v.deliverBy || !v.readyFrom || v.deliverBy >= v.readyFrom, {
    message: 'provider:err.dates',
    path: ['deliverBy'],
  })

export type LoadForm = z.input<typeof loadFormSchema>

export const shipperSchema = z.object({
  name: z.string().trim().min(2, 'provider:err.name').max(80, 'provider:err.name'),
  phone: z
    .string()
    .trim()
    .regex(/^(\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/, 'provider:err.phone'),
})

export const emptyLoad = (): LoadForm => ({
  goods: '',
  from: '',
  to: '',
  lengthCm: '',
  widthCm: '',
  heightCm: '',
  weightKg: '',
  quantity: '1',
  fragile: false,
  priceInr: '',
  readyFrom: '',
  deliverBy: '',
  note: '',
})

/** First message for each field that fails (keys as in the form). */
export function formErrors<T>(r: z.ZodSafeParseResult<T>): Record<string, string> {
  const out: Record<string, string> = {}
  if (r.success) return out
  for (const i of r.error.issues) {
    const k = String(i.path[0] ?? '')
    if (!out[k]) out[k] = i.message
  }
  return out
}

export interface WorthInput {
  /** extra km the truck drives for this load */
  km: number
  costPerKmInr: number
  /** total kg of the load */
  kg: number
  handlingInrPerKg: number
  /** the profit the owner wants at least (settings min margin) */
  minMarginInr: number
  offerInr: number
}

export interface Worth {
  costInr: number
  /** the price that covers the cost and the minimum profit */
  needInr: number
  profitInr: number
  worth: boolean
}

/** "Is ₹X worth it?" — cost of the km and handling, the price needed for the minimum profit, profit at ₹X. */
export function offerWorth(i: WorthInput): Worth {
  const cost = Math.round(
    Math.max(0, i.km) * Math.max(0, i.costPerKmInr) + Math.max(0, i.kg) * Math.max(0, i.handlingInrPerKg),
  )
  const need = cost + Math.max(0, Math.round(i.minMarginInr))
  const profit = Math.round(i.offerInr) - cost
  return { costInr: cost, needInr: need, profitInr: profit, worth: Math.round(i.offerInr) >= need }
}

/** Road km for carrying the load on its own: straight line × road factor. */
export function roadKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  roadFactor: number,
): number {
  return Math.round(kmBetween(a.lat, a.lng, b.lat, b.lng) * (roadFactor > 0 ? roadFactor : 1.25))
}
