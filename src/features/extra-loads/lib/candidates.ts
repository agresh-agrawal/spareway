// Extra loads on the way (Architecture F19): every open listing goes through the evaluation engine
// (lib/evaluate.ts) against the trip, then gets the ExtraCandidate fields the contract names and is sorted —
// ACCEPT first by profit, then the rest.
import type { ExtraCandidate, FeasibilityReason, PackItem } from '@/types/domain'
import type { LngLat } from '@/features/routes'
import {
  evaluateLoad,
  loadPackItems,
  type Decision,
  type EvalReason,
  type Evaluation,
  type LoadInput,
  type SpaceCheck,
  type StopPoint,
} from './evaluate'

export { corridorKm, DEFAULT_CORRIDOR_KM, REUSE_STOP_KM, STOP_WAIT_MIN, KM_PER_NEW_STOP } from './evaluate'
export type { SpaceCheck, StopPoint } from './evaluate'

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
  internal_length_cm?: number
  internal_width_cm?: number
  internal_height_cm?: number
  payload_kg?: number
}

export interface EvalInput {
  listings: ListingInput[]
  line: LngLat[]
  approximate: boolean
  stops: StopPoint[]
  settings: EvalSettings
  truck: EvalTruck
  /** payload − booked cargo weight */
  remainingPayloadKg: number
  /**
   * Space check per listing id. Not given → first pass: space is assumed OK only to find which loads to check.
   * Given → a listing missing from it is NEEDS_REVIEW ("placement not established").
   */
  space?: Map<string, SpaceCheck>
}

export interface Candidate extends ExtraCandidate {
  listing: ListingInput
  evaluation: Evaluation
  decision: Decision
  units: number
  kg: number
  m3: number
  newStops: number
  pickupAfterSeq: number
  dropAfterSeq: number
  loadOrder: number
  unloadOrder: number
  offKm: number
}

const OPEN = new Set(['open', 'reserved'])

/** A listing as an engine load (one batch). */
export function listingLoad(l: ListingInput): LoadInput {
  return {
    id: l.id,
    label: l.goods_type,
    batches: [
      {
        label: l.goods_type,
        quantity: Math.max(1, Math.floor(Number(l.quantity))),
        lengthCm: Number(l.length_cm),
        widthCm: Number(l.width_cm),
        heightCm: Number(l.height_cm),
        weightKg: Number(l.weight_kg),
        fragile: l.fragile,
        stackable: l.stackable,
        uprightOnly: l.upright_only,
      },
    ],
    pickup: { name: l.pickup_name, lat: l.pickup_lat, lng: l.pickup_lng },
    drop: { name: l.drop_name, lat: l.drop_lat, lng: l.drop_lng },
    offerInr: Number(l.offered_rate_inr),
  }
}

const FEASIBILITY: Partial<Record<EvalReason, FeasibilityReason>> = {
  OVER_PAYLOAD: 'OVER_PAYLOAD',
  TOO_LARGE: 'NO_SPACE',
  NO_SPACE: 'NO_SPACE',
  OFF_CORRIDOR: 'OFF_CORRIDOR',
  WRONG_DIRECTION: 'WRONG_DIRECTION',
  ORDER_CONFLICT: 'ORDER_CONFLICT',
  LOW_MARGIN: 'LOW_MARGIN',
}

function detailFor(ev: Evaluation): string {
  switch (ev.reason) {
    case 'OFF_CORRIDOR':
      return `${Math.round(ev.offKm)} km off your route`
    case 'WRONG_DIRECTION':
      return 'Goes the opposite way'
    case 'OVER_PAYLOAD':
      return `Too heavy: ${ev.kg} kg > ${Math.round(ev.remainingKg)} kg left`
    case 'TOO_LARGE':
      return 'Bigger than the inside of the truck'
    case 'NO_SPACE':
      return 'No space left in the truck'
    case 'ORDER_CONFLICT':
      return 'Would block goods that leave earlier'
    case 'LOW_MARGIN':
      return `Earns only ₹${ev.earningsInr} after costs — needs ≥ ₹${ev.minViableInr}`
    case undefined:
      return ''
    default:
      return 'Needs manual verification'
  }
}

const RANK: Record<Decision, number> = { ACCEPT: 0, NOT_PROFITABLE: 1, NEEDS_REVIEW: 2, REJECT: 3 }

export function evaluateCandidates(input: EvalInput): Candidate[] {
  const { settings, truck } = input
  const ctx = {
    line: input.line,
    approximate: input.approximate,
    stops: input.stops,
    truck: {
      lengthCm: Number(truck.internal_length_cm ?? 1e6),
      widthCm: Number(truck.internal_width_cm ?? 1e6),
      heightCm: Number(truck.internal_height_cm ?? 1e6),
      payloadKg: Number(truck.payload_kg ?? input.remainingPayloadKg),
      costPerKmInr: Number(truck.cost_per_km_inr),
    },
    existingKg: Number(truck.payload_kg ?? input.remainingPayloadKg) - input.remainingPayloadKg,
    settings,
  }
  const out: Candidate[] = []
  for (const l of input.listings) {
    if (!OPEN.has(l.status)) continue
    const space: SpaceCheck | undefined = input.space ? input.space.get(l.id) : 'OK'
    const ev = evaluateLoad(listingLoad(l), ctx, space)
    const reason = ev.reason ? FEASIBILITY[ev.reason] : undefined
    out.push({
      listingId: l.id,
      code: l.code,
      pickupKm: ev.pickupKm,
      dropKm: ev.dropKm,
      detourKm: ev.extraKm,
      detourMin: Math.round((ev.extraKm / (settings.avg_speed_kmph > 0 ? settings.avg_speed_kmph : 45)) * 60 + ev.newStops * 30),
      cost: {
        detourInr: ev.costs.operatingInr,
        tollsInr: ev.costs.tollsInr,
        handlingInr: ev.costs.handlingInr,
        waitingInr: ev.costs.waitingInr,
        delayInr: 0,
        totalInr: ev.costs.totalInr,
      },
      netBenefitInr: ev.earningsInr,
      minViableRateInr: ev.minViableInr,
      recommended: ev.decision === 'ACCEPT',
      approximate: ev.approximate,
      explanation: { en: '', hi: '' },
      feasibility: ev.decision === 'ACCEPT' ? { ok: true, detail: '' } : { ok: false, ...(reason ? { reason } : {}), detail: detailFor(ev) },
      listing: l,
      evaluation: ev,
      decision: ev.decision,
      units: ev.units,
      kg: ev.kg,
      m3: ev.m3,
      newStops: ev.newStops,
      pickupAfterSeq: ev.pickupAfterSeq,
      dropAfterSeq: ev.dropAfterSeq,
      loadOrder: ev.loadOrder,
      unloadOrder: ev.unloadOrder,
      offKm: ev.offKm,
    })
  }
  return out.sort(
    (a, b) =>
      RANK[a.decision] - RANK[b.decision] ||
      (a.recommended ? 0 : rankReason(a) - rankReason(b)) ||
      b.netBenefitInr - a.netBenefitInr ||
      a.code.localeCompare(b.code),
  )
}

const REASON_ORDER: Record<string, number> = { LOW_MARGIN: 0, ORDER_CONFLICT: 1, NO_SPACE: 2, OVER_PAYLOAD: 3, WRONG_DIRECTION: 4, OFF_CORRIDOR: 5 }
const rankReason = (c: Candidate) => REASON_ORDER[c.feasibility.reason ?? ''] ?? 6

/** Units of a listing as packing items (keys `<listingId>#n`), between existing stops. */
export function listingPackItems(c: Pick<Candidate, 'listing' | 'loadOrder' | 'unloadOrder'>): PackItem[] {
  return loadPackItems(listingLoad(c.listing), c)
}
