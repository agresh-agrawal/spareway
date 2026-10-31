import { places } from '@/features/trips'
import type { ProviderLoad, SharedLoad } from '../api'
import { loadFormSchema, type LoadForm } from './offer'

/** A checked form → what the server takes (places looked up by id). */
export function toProviderLoad(v: ReturnType<typeof loadFormSchema.parse>): ProviderLoad {
  const from = places.find((p) => p.id === v.from)!
  const to = places.find((p) => p.id === v.to)!
  return {
    goods: v.goods,
    note: v.note.trim(),
    pickupName: from.name,
    pickupLat: from.lat,
    pickupLng: from.lng,
    dropName: to.name,
    dropLat: to.lat,
    dropLng: to.lng,
    lengthCm: v.lengthCm,
    widthCm: v.widthCm,
    heightCm: v.heightCm,
    weightKg: v.weightKg,
    quantity: v.quantity,
    fragile: v.fragile,
    priceInr: v.priceInr,
    readyFrom: v.readyFrom,
    deliverBy: v.deliverBy,
  }
}

const day = (iso: string) =>
  iso ? new Date(new Date(iso).getTime() + 330 * 60_000).toISOString().slice(0, 10) : ''

/** A posted load back into the form (for "Change load"). */
export function toForm(l: SharedLoad['load']): LoadForm {
  return {
    goods: l.goods,
    from: places.find((p) => p.name === l.pickupName)?.id ?? '',
    to: places.find((p) => p.name === l.dropName)?.id ?? '',
    lengthCm: String(l.lengthCm),
    widthCm: String(l.widthCm),
    heightCm: String(l.heightCm),
    weightKg: String(l.weightKg),
    quantity: String(l.quantity),
    fragile: l.fragile,
    priceInr: String(l.priceInr),
    readyFrom: day(l.readyFrom),
    deliverBy: day(l.deliverBy),
    note: l.note ?? '',
  }
}

/** Loads this phone posted, so the provider can open them again (share token + code). */
export const MY_LOADS_KEY = 'spareway.myLoads'
export function rememberLoads(list: { code: string; shareToken: string }[]) {
  try {
    const old = JSON.parse(localStorage.getItem(MY_LOADS_KEY) ?? '[]') as {
      code: string
      shareToken: string
    }[]
    localStorage.setItem(
      MY_LOADS_KEY,
      JSON.stringify(
        [...list, ...old.filter((o) => !list.some((n) => n.shareToken === o.shareToken))].slice(0, 30),
      ),
    )
  } catch {
    /* private window */
  }
}
export function myLoads(): { code: string; shareToken: string }[] {
  try {
    return JSON.parse(localStorage.getItem(MY_LOADS_KEY) ?? '[]') as { code: string; shareToken: string }[]
  } catch {
    return []
  }
}
