// Fixture mode only: the same work as the database triggers cargo_integrity_guard and cargo_log_change
// (prephase4code_cargo_integrity.sql), on the in-memory store, so ?fixture=seed behaves like the live site.
import { AppError } from '@/lib/errors'
import { kmBetween } from '@/lib/geo'
import type { FixtureData } from '@/lib/fixtures'
import type { Tables } from '@/types/database'
import { checkCargo, defaultTareKg, needsEvidence, weighStatus, WEIGH_MAX_KM } from './integrity'

type Row = Tables<'cargo_items'>
type Actor = 'owner' | 'loader' | 'system'

export const LOCKED_STATUSES = ['in_transit', 'completed', 'cancelled']
const LOGGED = [
  'label',
  'length_cm',
  'width_cm',
  'height_cm',
  'weight_kg',
  'quantity',
  'drop_stop_id',
  'fragile',
  'upright_only',
  'stackable',
  'evidence_path',
  'integrity_note',
] as const

export const integrityDefaults = {
  integrity_flags: [] as string[],
  integrity_status: 'ok',
  evidence_path: null,
  integrity_note: null,
  integrity_confirmed_at: null,
  integrity_confirmed_by: null,
}

export function assertNotLocked(d: FixtureData, tripId: string) {
  const status = d.trips.find((t) => t.id === tripId)?.status ?? ''
  if (LOCKED_STATUSES.includes(status)) throw new AppError('BAD_STATUS', 'BAD_STATUS: CARGO_LOCKED')
}

export function logChange(
  d: FixtureData,
  action: 'insert' | 'update' | 'delete',
  old: Row | undefined,
  row: Row,
  actor: Actor,
) {
  if (action === 'insert' && row.source === 'seed') return
  const changes: Record<string, [unknown, unknown]> = {}
  for (const f of LOGGED) {
    const a = action === 'insert' ? null : (old?.[f] ?? null)
    const b = action === 'delete' ? null : (row[f] ?? null)
    if (a !== b) changes[f] = [a, b]
  }
  if (action === 'update' && Object.keys(changes).length === 0) return
  d.cargo_changes.unshift({
    id: crypto.randomUUID(),
    company_id: row.company_id,
    trip_id: row.trip_id,
    cargo_item_id: row.id,
    action,
    actor,
    actor_user: actor === 'owner' ? d.profile.id : null,
    label: row.label,
    changes: changes as never,
    created_at: new Date().toISOString(),
  })
}

/** Check one line before it is stored (refuses impossible values, sets flags + status) and log the change. */
export function guardCargo(d: FixtureData, row: Row, opts: { old?: Row; actor: Actor; log?: boolean }): Row {
  // the database locks only signed-in / anonymous clients; loader and extra-load RPCs run as definer
  if (opts.actor === 'owner' && row.source !== 'extra_load') assertNotLocked(d, row.trip_id)
  const trip = d.trips.find((t) => t.id === row.trip_id)
  const tr = d.trucks.find((x) => x.id === trip?.truck_id)
  const truck = tr
    ? {
        lengthCm: tr.internal_length_cm,
        widthCm: tr.internal_width_cm,
        heightCm: tr.internal_height_cm,
        payloadKg: tr.payload_kg,
      }
    : null
  const r = checkCargo(
    row,
    truck,
    d.cargo_items.filter((c) => c.trip_id !== row.trip_id),
  )
  if (r.blocks.length) throw new AppError('BAD_ITEMS', `BAD_ITEMS: CARGO_IMPOSSIBLE ${r.blocks[0]}`)
  const old = opts.old
  if (
    old &&
    (['label', 'length_cm', 'width_cm', 'height_cm', 'weight_kg', 'quantity'] as const).some(
      (f) => old[f] !== row[f],
    )
  )
    Object.assign(row, { integrity_note: null, integrity_confirmed_at: null, integrity_confirmed_by: null })
  row.integrity_flags = r.flags
  row.integrity_status = !needsEvidence(r.flags)
    ? 'ok'
    : row.evidence_path || row.image_path || row.integrity_confirmed_at
      ? 'checked'
      : 'review'
  if (opts.log !== false) logChange(d, old ? 'update' : 'insert', old, row, opts.actor)
  return row
}

/** Weighbridge slip (same rules as trip_weighing_compute). */
export function fixtureWeighing(
  d: FixtureData,
  w: {
    tripId: string
    grossKg: number
    tareKg: number | null
    slipPath: string | null
    lat: number | null
    lng: number | null
    accuracyM: number | null
    enteredBy: 'owner' | 'driver'
  },
): Tables<'trip_weighings'> {
  const trip = d.trips.find((t) => t.id === w.tripId)
  if (!trip) throw new AppError('TRIP_NOT_FOUND')
  if (w.enteredBy === 'owner' && !w.slipPath) throw new AppError('BAD_ITEMS', 'BAD_ITEMS: SLIP_NEEDED')
  const truck = d.trucks.find((x) => x.id === trip.truck_id)
  const tare = w.tareKg ?? (truck ? defaultTareKg(truck) : null)
  if (!tare || w.grossKg <= tare) throw new AppError('BAD_ITEMS', 'BAD_ITEMS: WEIGHT_TARE')
  const net = w.grossKg - tare
  const declared = d.cargo_items
    .filter((c) => c.trip_id === trip.id)
    .reduce((a, c) => a + Number(c.weight_kg) * c.quantity, 0)
  const ws = weighStatus(net, declared)
  const lat = w.lat
  const lng = w.lng
  const starts = d.trip_stops.filter(
    (s) => s.trip_id === trip.id && (s.stop_type === 'origin' || s.stop_type === 'pickup'),
  )
  const km =
    lat != null && lng != null && starts.length
      ? Math.min(...starts.map((s) => kmBetween(lat, lng, s.lat, s.lng)))
      : null
  const row: Tables<'trip_weighings'> = {
    id: crypto.randomUUID(),
    company_id: trip.company_id,
    trip_id: trip.id,
    gross_kg: w.grossKg,
    tare_kg: tare,
    net_kg: net,
    declared_kg: declared,
    diff_kg: ws.diffKg,
    status: ws.match ? 'match' : 'mismatch',
    slip_path: w.slipPath,
    lat,
    lng,
    accuracy_m: w.accuracyM,
    distance_km: km,
    place_ok: km !== null && km <= WEIGH_MAX_KM,
    entered_by: w.enteredBy,
    note: '',
    created_at: new Date().toISOString(),
  }
  d.trip_weighings.unshift(row)
  if (!(row.status === 'match' && row.place_ok))
    d.notifications.unshift({
      id: crypto.randomUUID(),
      company_id: trip.company_id,
      trip_id: trip.id,
      kind: 'weighing_check',
      severity: 'warning',
      major: true,
      title: `${trip.code}: weighbridge ${Math.round(net)} kg vs declared ${Math.round(declared)} kg`,
      meta: {
        code: trip.code,
        net: Math.round(net),
        declared: Math.round(declared),
        diff: Math.round(ws.diffKg),
        match: ws.match,
        placeOk: row.place_ok,
      },
      link: `/trips/${trip.id}?step=cargo`,
      read_at: null,
      emailed_at: null,
      is_sample: false,
      created_at: row.created_at,
    })
  return row
}
