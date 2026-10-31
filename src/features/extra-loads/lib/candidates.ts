// Extra loads on the way (Architecture F19): which open loads fit the trip — near the route (corridor),
// the right way along it, within the weight and space left — and which make money after the detour.
// Pure and deterministic; the space check (packing engine) is done by the caller and passed in.
import { kmBetween } from '@/lib/geo'
import { makeLine, project, type LngLat } from '@/features/routes'
import type { ExtraCandidate, FeasibilityReason } from '@/types/domain'

export interface ListingInput {
  id: string
  code: string
  company_id: string
  visibility: string
  status: string
  shipper_name: string
  goods_type: string
  description: string
  pickup_name: string
  pickup_lat: number
  pickup_lng: number
  drop_name: string
  drop_lat: number
  drop_lng: number
  length_cm: number
  width_cm: number
  height_cm: number
  weight_kg: number
  quantity: number
  fragile: boolean
  upright_only: boolean
  stackable: boolean
  offered_rate_inr: number
  ready_from: string | null
  deliver_by: string | null
  is_sample: boolean
}

export interface StopPoint {
  id: string
  seq: number
  lat: number
  lng: number
}

export interface EvalSettings {
  corridor_km: number
  road_factor: number
  handling_inr_per_kg: number
  waiting_cost_inr_per_h: number
  delay_penalty_inr_per_min: number
  min_margin_inr: number
  avg_speed_kmph: number
}

export interface EvalTruck {
  cost_per_km_inr: number
}

export type SpaceCheck = 'OK' | 'NO_SPACE' | 'ORDER_CONFLICT'

export interface EvalInput {
  listings: ListingInput[]
  /** route line [lng, lat][] — the chosen route, else a line through the stops (approximate) */
  line: LngLat[]
  approximate: boolean
  stops: StopPoint[]
  settings: EvalSettings
  truck: EvalTruck
  /** payload − booked cargo weight */
  remainingPayloadKg: number
  /** result of fitting each listing's units into the truck (by listing id); missing = not checked yet */
  space?: Map<string, SpaceCheck>
}

export interface Candidate extends ExtraCandidate {
  listing: ListingInput
  units: number
  kg: number
  m3: number
  newStops: number
  /** for accept_extra_load: insert the pickup / drop after these stop seqs (or reuse a stop within 2 km) */
  pickupAfterSeq: number
  dropAfterSeq: number
  /** load / unload order for the packing engine, between existing stops */
  loadOrder: number
  unloadOrder: number
  /** extra numbers for the plain reason */
  offKm: number
}

/** Owner's answer: look up to 40 km off route. The old database default (20 km) is read as 40 until it changes. */
export const DEFAULT_CORRIDOR_KM = 40
export function corridorKm(settingKm: number): number {
  return !settingKm || settingKm === 20 ? DEFAULT_CORRIDOR_KM : settingKm
}

/** Stops within this distance are reused (same rule as SQL accept_extra_load). */
export const REUSE_STOP_KM = 2
/** Loading or unloading time at a new stop. */
export const STOP_WAIT_MIN = 30
export const KM_PER_NEW_STOP = 3
const DIRECTION_TOLERANCE_KM = 1

const OPEN = new Set(['open', 'reserved'])

/** Insert position along the route: the last stop (by seq) that comes before km. */
function afterSeq(stopKms: { seq: number; km: number }[], km: number, atLeast = 0): number {
  let best = atLeast
  for (const s of stopKms) if (s.km <= km + 1e-6 && s.seq >= best) best = s.seq
  return best
}

export function evaluateCandidates(input: EvalInput): Candidate[] {
  const { settings, truck } = input
  const line = makeLine(input.line)
  const corridor = corridorKm(settings.corridor_km)
  const speed = settings.avg_speed_kmph > 0 ? settings.avg_speed_kmph : 45
  const stops = [...input.stops].sort((a, b) => a.seq - b.seq)
  // stops on the line, in order
  let seg = 0
  const stopKms = stops.map((s) => {
    const pr = project(line, [s.lng, s.lat], seg)
    seg = pr.segment
    return { seq: s.seq, km: s.seq === 0 ? 0 : pr.km, lat: s.lat, lng: s.lng }
  })
  const nearStop = (lat: number, lng: number, minSeq = -1) =>
    stopKms.find((s) => s.seq > minSeq && kmBetween(lat, lng, s.lat, s.lng) <= REUSE_STOP_KM)

  const out: Candidate[] = []
  for (const l of input.listings) {
    if (!OPEN.has(l.status)) continue
    const pick = project(line, [l.pickup_lng, l.pickup_lat])
    const drop = project(line, [l.drop_lng, l.drop_lat])
    const units = Math.max(1, Math.floor(Number(l.quantity)))
    const kg = units * Number(l.weight_kg)
    const m3 = (units * Number(l.length_cm) * Number(l.width_cm) * Number(l.height_cm)) / 1e6
    const offer = Number(l.offered_rate_inr)

    const pickStop = nearStop(l.pickup_lat, l.pickup_lng)
    const pickupAfterSeq = pickStop ? pickStop.seq : afterSeq(stopKms, pick.km)
    const dropStop = nearStop(l.drop_lat, l.drop_lng, pickStop ? pickStop.seq : pickupAfterSeq)
    const dropAfterSeq = dropStop ? dropStop.seq : afterSeq(stopKms, drop.km, pickupAfterSeq)
    const newStops = (pickStop ? 0 : 1) + (dropStop ? 0 : 1)

    // detour ≈ 2 × (pickup + drop offset) × road factor + 3 km per new stop
    const offKm = Math.max(pick.offKm, drop.offKm)
    const detourKm = Math.round((2 * (pick.offKm + drop.offKm) * settings.road_factor + KM_PER_NEW_STOP * newStops) * 10) / 10
    const detourMin = Math.round((detourKm / speed) * 60 + STOP_WAIT_MIN * newStops)
    const detourInr = Math.round(detourKm * Number(truck.cost_per_km_inr))
    const tollsInr = 0
    const handlingInr = Math.round(kg * settings.handling_inr_per_kg)
    const waitingInr = Math.round(((STOP_WAIT_MIN * newStops) / 60) * settings.waiting_cost_inr_per_h)
    const delayInr = Math.round((detourKm / speed) * 60 * settings.delay_penalty_inr_per_min)
    const totalInr = detourInr + tollsInr + handlingInr + waitingInr + delayInr
    const net = offer - totalInr
    const minViable = totalInr + settings.min_margin_inr

    let reason: FeasibilityReason | undefined
    let detail = ''
    if (pick.offKm > corridor || drop.offKm > corridor) {
      reason = 'OFF_CORRIDOR'
      detail = `${Math.round(offKm)} km off your route`
    } else if (drop.km <= pick.km + DIRECTION_TOLERANCE_KM) {
      reason = 'WRONG_DIRECTION'
      detail = 'Goes the opposite way'
    } else if (kg > input.remainingPayloadKg + 1e-6) {
      reason = 'OVER_PAYLOAD'
      detail = `Too heavy: ${kg} kg > ${Math.round(input.remainingPayloadKg)} kg left`
    } else if (input.space?.get(l.id) && input.space.get(l.id) !== 'OK') {
      reason = input.space.get(l.id) as 'NO_SPACE' | 'ORDER_CONFLICT'
      detail = reason === 'NO_SPACE' ? 'No space left in the truck' : 'Would block goods that leave earlier'
    } else if (net < settings.min_margin_inr) {
      reason = 'LOW_MARGIN'
      detail = `Earns only ₹${net} after costs — needs ≥ ₹${minViable}`
    }

    out.push({
      listingId: l.id,
      code: l.code,
      pickupKm: Math.round(pick.km * 10) / 10,
      dropKm: Math.round(drop.km * 10) / 10,
      detourKm,
      detourMin,
      cost: { detourInr, tollsInr, handlingInr, waitingInr, delayInr, totalInr },
      netBenefitInr: net,
      minViableRateInr: minViable,
      recommended: !reason,
      approximate: input.approximate,
      explanation: { en: '', hi: '' },
      feasibility: reason ? { ok: false, reason, detail } : { ok: true, detail: '' },
      listing: l,
      units,
      kg,
      m3,
      newStops,
      pickupAfterSeq,
      dropAfterSeq,
      loadOrder: pickStop ? pickStop.seq : pickupAfterSeq + 0.5,
      unloadOrder: dropStop ? dropStop.seq : dropAfterSeq + 0.5,
      offKm: Math.round(offKm * 10) / 10,
    })
  }
  // recommended first by profit, then the rest by reason order and profit
  const rank: Record<string, number> = { OFF_CORRIDOR: 5, WRONG_DIRECTION: 4, OVER_PAYLOAD: 3, NO_SPACE: 2, ORDER_CONFLICT: 2, TOO_LATE: 1, LOW_MARGIN: 0 }
  return out.sort(
    (a, b) =>
      Number(b.recommended) - Number(a.recommended) ||
      (a.recommended ? 0 : rank[a.feasibility.reason ?? ''] - rank[b.feasibility.reason ?? '']) ||
      b.netBenefitInr - a.netBenefitInr ||
      a.code.localeCompare(b.code),
  )
}

/** Units of a listing as packing items (keys `<listingId>#n`), between existing stops. */
export function listingPackItems(c: Pick<Candidate, 'listing' | 'units' | 'loadOrder' | 'unloadOrder'>) {
  const l = c.listing
  return Array.from({ length: c.units }, (_, i) => ({
    key: `${l.id}#${i + 1}`,
    cargoItemId: l.id,
    label: l.goods_type,
    l: Number(l.length_cm),
    w: Number(l.width_cm),
    h: Number(l.height_cm),
    weightKg: Number(l.weight_kg),
    unloadOrder: c.unloadOrder,
    loadOrder: c.loadOrder,
    fragile: l.fragile,
    uprightOnly: l.upright_only,
    stackable: l.stackable,
  }))
}
