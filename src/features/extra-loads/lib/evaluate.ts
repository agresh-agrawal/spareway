// Additional Cargo Evaluation Engine (owner addition to F19). Every candidate — a marketplace listing or a load
// the owner types in — goes through this one function. Pure and deterministic; the space check (packing
// engine) is done by the caller and passed in. Checks in order: payload · space · delivery order (+ corridor and
// direction) · cost. Decision: ACCEPT · REJECT (any physical / order failure — profit never overrides it) ·
// NOT_PROFITABLE · NEEDS_REVIEW (missing or uncertain data — never a guess).
import { kmBetween } from '@/lib/geo'
import { makeLine, project, type LngLat } from '@/features/routes'
import type { PackItem } from '@/types/domain'

export type Decision = 'ACCEPT' | 'REJECT' | 'NOT_PROFITABLE' | 'NEEDS_REVIEW'
export type CheckState = 'PASS' | 'FAIL' | 'REVIEW'
export type SpaceCheck = 'OK' | 'NO_SPACE' | 'ORDER_CONFLICT'

/** Why it isn't ACCEPT (first failing check wins). */
export type EvalReason =
  | 'MISSING_TRUCK'
  | 'MISSING_ROUTE'
  | 'MISSING_LOAD'
  | 'MISSING_OFFER'
  | 'OVER_PAYLOAD'
  | 'TOO_LARGE'
  | 'NO_SPACE'
  | 'SPACE_UNKNOWN'
  | 'OFF_CORRIDOR'
  | 'WRONG_DIRECTION'
  | 'ORDER_CONFLICT'
  | 'LOW_MARGIN'

export interface Batch {
  label: string
  quantity: number
  lengthCm: number
  widthCm: number
  heightCm: number
  weightKg: number
  fragile?: boolean
  stackable?: boolean
  uprightOnly?: boolean
}

export interface Place {
  name: string
  lat: number
  lng: number
}

export interface LoadInput {
  /** listing id, or an id for a typed load */
  id: string
  label: string
  batches: Batch[]
  pickup: Place
  drop: Place
  offerInr: number
  /** typed by the owner; else Settings handling ₹/kg × kg */
  handlingInr?: number | null
  /** typed by the owner; else 30 min per new stop × Settings waiting ₹/h */
  waitingInr?: number | null
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
  min_margin_inr: number
}

export interface EvalTruck {
  lengthCm: number
  widthCm: number
  heightCm: number
  payloadKg: number
  costPerKmInr: number
}

export interface TripContext {
  /** route line [lng, lat][] — the chosen route, else a line through the stops */
  line: LngLat[]
  approximate: boolean
  stops: StopPoint[]
  truck: EvalTruck
  /** weight of the cargo already on the trip */
  existingKg: number
  settings: EvalSettings
}

export interface Evaluation {
  decision: Decision
  checks: { payload: CheckState; space: CheckState; order: CheckState }
  reason?: EvalReason
  units: number
  kg: number
  m3: number
  remainingKg: number
  pickupKm: number
  dropKm: number
  /** furthest distance of pickup / drop from the route */
  offKm: number
  /** estimated extra km: 2 × (pickup + drop offset) × road factor + 3 km per new stop */
  extraKm: number
  newStops: number
  /** for accept_extra_load: insert after these stop seqs (or reuse a stop within 2 km) */
  pickupAfterSeq: number
  dropAfterSeq: number
  /** packing order between existing stops */
  loadOrder: number
  unloadOrder: number
  costs: { operatingInr: number; tollsInr: number; handlingInr: number; waitingInr: number; totalInr: number }
  earningsInr: number
  /** the offer it would need to reach the minimum profit */
  minViableInr: number
  approximate: boolean
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

const pos = (v: unknown) => Number.isFinite(Number(v)) && Number(v) > 0
const r1 = (v: number) => Math.round(v * 10) / 10

/** Does one piece fit the truck's inside in any allowed orientation? */
export function fitsInside(b: Batch, t: EvalTruck): boolean {
  const dims = [b.lengthCm, b.widthCm, b.heightCm]
  const orients = b.uprightOnly
    ? [
        [dims[0], dims[1], dims[2]],
        [dims[1], dims[0], dims[2]],
      ]
    : [
        [0, 1, 2],
        [1, 0, 2],
        [0, 2, 1],
        [2, 0, 1],
        [1, 2, 0],
        [2, 1, 0],
      ].map(([a, c, e]) => [dims[a], dims[c], dims[e]])
  return orients.some(([l, w, h]) => l <= t.lengthCm && w <= t.widthCm && h <= t.heightCm)
}

export function evaluateLoad(load: LoadInput, ctx: TripContext, space?: SpaceCheck): Evaluation {
  const { settings, truck } = ctx
  const batches = load.batches
  const units = batches.reduce((a, b) => a + Math.max(0, Math.floor(Number(b.quantity) || 0)), 0)
  const kg = batches.reduce((a, b) => a + Math.max(0, Math.floor(Number(b.quantity) || 0)) * (Number(b.weightKg) || 0), 0)
  const m3 = batches.reduce((a, b) => a + (Math.floor(Number(b.quantity) || 0) * (Number(b.lengthCm) || 0) * (Number(b.widthCm) || 0) * (Number(b.heightCm) || 0)) / 1e6, 0)
  const remainingKg = Number(truck.payloadKg) - ctx.existingKg

  // ---- missing data → NEEDS_REVIEW (checked first, never guessed)
  const truckOk = pos(truck.lengthCm) && pos(truck.widthCm) && pos(truck.heightCm) && pos(truck.payloadKg) && pos(truck.costPerKmInr)
  const routeOk = ctx.line.length >= 2 && ctx.stops.length >= 2
  const loadOk =
    batches.length > 0 &&
    batches.every((b) => pos(b.quantity) && pos(b.lengthCm) && pos(b.widthCm) && pos(b.heightCm) && pos(b.weightKg)) &&
    [load.pickup.lat, load.pickup.lng, load.drop.lat, load.drop.lng].every((v) => Number.isFinite(Number(v)))
  const offerOk = Number.isFinite(Number(load.offerInr)) && Number(load.offerInr) >= 0
  const missing: EvalReason | undefined = !truckOk ? 'MISSING_TRUCK' : !routeOk ? 'MISSING_ROUTE' : !loadOk ? 'MISSING_LOAD' : !offerOk ? 'MISSING_OFFER' : undefined

  const line = makeLine(routeOk ? ctx.line : [[0, 0], [0, 0]])
  const stops = [...ctx.stops].sort((a, b) => a.seq - b.seq)
  let seg = 0
  const stopKms = stops.map((s) => {
    const pr = project(line, [s.lng, s.lat], seg)
    seg = pr.segment
    return { seq: s.seq, km: s.seq === 0 ? 0 : pr.km, lat: s.lat, lng: s.lng }
  })
  const nearStop = (lat: number, lng: number, minSeq = -1) =>
    stopKms.find((s) => s.seq > minSeq && kmBetween(lat, lng, s.lat, s.lng) <= REUSE_STOP_KM)
  const afterSeq = (km: number, atLeast = 0) => {
    let best = atLeast
    for (const s of stopKms) if (s.km <= km + 1e-6 && s.seq >= best) best = s.seq
    return best
  }

  const pick = project(line, [load.pickup.lng, load.pickup.lat])
  const drop = project(line, [load.drop.lng, load.drop.lat])
  const pickStop = nearStop(load.pickup.lat, load.pickup.lng)
  const pickupAfterSeq = pickStop ? pickStop.seq : afterSeq(pick.km)
  const dropStop = nearStop(load.drop.lat, load.drop.lng, pickStop ? pickStop.seq : pickupAfterSeq)
  const dropAfterSeq = dropStop ? dropStop.seq : afterSeq(drop.km, pickupAfterSeq)
  const newStops = (pickStop ? 0 : 1) + (dropStop ? 0 : 1)
  const offKm = Math.max(pick.offKm, drop.offKm)

  // ---- cost: only what this load adds (never the whole trip)
  const extraKm = r1(2 * (pick.offKm + drop.offKm) * settings.road_factor + KM_PER_NEW_STOP * newStops)
  const operatingInr = Math.round(extraKm * Number(truck.costPerKmInr))
  const tollsInr = 0 // extra tolls are not known before exact routing
  const handlingInr = Math.round(load.handlingInr ?? kg * settings.handling_inr_per_kg)
  const waitingInr = Math.round(load.waitingInr ?? ((STOP_WAIT_MIN * newStops) / 60) * settings.waiting_cost_inr_per_h)
  const totalInr = operatingInr + tollsInr + handlingInr + waitingInr
  const earningsInr = Math.round(Number(load.offerInr) - totalInr)
  const minViableInr = totalInr + settings.min_margin_inr

  // ---- checks
  const tooLarge = loadOk && truckOk && batches.some((b) => !fitsInside(b, truck))
  const payload: CheckState = !loadOk || !truckOk ? 'REVIEW' : kg > remainingKg + 1e-6 ? 'FAIL' : 'PASS'
  const spaceState: CheckState = !loadOk || !truckOk ? 'REVIEW' : tooLarge || space === 'NO_SPACE' ? 'FAIL' : space === 'OK' || space === 'ORDER_CONFLICT' ? 'PASS' : 'REVIEW'
  const corridor = corridorKm(settings.corridor_km)
  const offCorridor = routeOk && loadOk && (pick.offKm > corridor || drop.offKm > corridor)
  const wrongWay = routeOk && loadOk && drop.km <= pick.km + DIRECTION_TOLERANCE_KM
  const order: CheckState = !routeOk || !loadOk ? 'REVIEW' : offCorridor || wrongWay || space === 'ORDER_CONFLICT' ? 'FAIL' : 'PASS'

  let decision: Decision
  let reason: EvalReason | undefined
  if (payload === 'FAIL' || spaceState === 'FAIL' || order === 'FAIL') {
    decision = 'REJECT'
    reason =
      payload === 'FAIL'
        ? 'OVER_PAYLOAD'
        : tooLarge
          ? 'TOO_LARGE'
          : spaceState === 'FAIL'
            ? 'NO_SPACE'
            : offCorridor
              ? 'OFF_CORRIDOR'
              : wrongWay
                ? 'WRONG_DIRECTION'
                : 'ORDER_CONFLICT'
  } else if (missing || spaceState === 'REVIEW' || payload === 'REVIEW' || order === 'REVIEW') {
    decision = 'NEEDS_REVIEW'
    reason = missing ?? 'SPACE_UNKNOWN'
  } else if (earningsInr <= 0 || earningsInr < settings.min_margin_inr) {
    decision = 'NOT_PROFITABLE'
    reason = 'LOW_MARGIN'
  } else decision = 'ACCEPT'

  return {
    decision,
    checks: { payload, space: spaceState, order },
    ...(reason ? { reason } : {}),
    units,
    kg: r1(kg),
    m3: Math.round(m3 * 100) / 100,
    remainingKg: r1(remainingKg),
    pickupKm: r1(pick.km),
    dropKm: r1(drop.km),
    offKm: r1(offKm),
    extraKm,
    newStops,
    pickupAfterSeq,
    dropAfterSeq,
    loadOrder: pickStop ? pickStop.seq : pickupAfterSeq + 0.5,
    unloadOrder: dropStop ? dropStop.seq : dropAfterSeq + 0.5,
    costs: { operatingInr, tollsInr, handlingInr, waitingInr, totalInr },
    earningsInr,
    minViableInr,
    approximate: ctx.approximate,
  }
}

/** The load's pieces for the packing engine (a batch of 40 = 40 boxes), keys `<loadId>#n`, between the stops. */
export function loadPackItems(load: Pick<LoadInput, 'id' | 'batches'>, ev: Pick<Evaluation, 'loadOrder' | 'unloadOrder'>): PackItem[] {
  const out: PackItem[] = []
  let n = 0
  for (const b of load.batches) {
    const qty = Math.max(0, Math.floor(Number(b.quantity) || 0))
    for (let i = 0; i < qty; i++) {
      n++
      out.push({
        key: `${load.id}#${n}`,
        cargoItemId: load.id,
        label: b.label,
        l: Number(b.lengthCm),
        w: Number(b.widthCm),
        h: Number(b.heightCm),
        weightKg: Number(b.weightKg),
        unloadOrder: ev.unloadOrder,
        loadOrder: ev.loadOrder,
        fragile: Boolean(b.fragile),
        uprightOnly: Boolean(b.uprightOnly),
        stackable: b.stackable ?? !b.fragile,
      })
    }
  }
  return out
}
