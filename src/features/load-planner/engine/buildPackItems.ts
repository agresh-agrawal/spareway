import type { PackContainer, PackItem } from '@/types/domain'

/** The cargo_items columns the engine needs (a Tables<'cargo_items'> row fits). */
export interface CargoRowInput {
  id: string
  label: string
  length_cm: number
  width_cm: number
  height_cm: number
  weight_kg: number
  quantity: number
  pickup_stop_id: string | null
  drop_stop_id: string
  fragile: boolean
  upright_only: boolean
  stackable: boolean
  max_top_load_kg: number | null
}

/** The trip_stops columns the engine needs. */
export interface StopInput {
  id: string
  seq: number
}

/** The trucks columns the engine needs. */
export interface TruckInput {
  internal_length_cm: number
  internal_width_cm: number
  internal_height_cm: number
  payload_kg: number
}

/**
 * Cargo rows → one PackItem per unit (`<cargoItemId>#<n>`, n from 1).
 * unloadOrder = seq of the drop stop (1 = first to leave), loadOrder = seq of the pickup stop (0 = origin).
 * Rows whose drop stop isn't on the trip leave last (after the final stop).
 */
export function buildPackItems(
  cargoRows: CargoRowInput[],
  stops: StopInput[],
  truck: TruckInput,
): { container: PackContainer; items: PackItem[] } {
  const seqOf = new Map(stops.map((s) => [s.id, s.seq]))
  const lastSeq = stops.reduce((m, s) => Math.max(m, s.seq), 0)
  const items: PackItem[] = []
  for (const row of cargoRows) {
    const unloadOrder = seqOf.get(row.drop_stop_id) ?? lastSeq + 1
    const loadOrder = row.pickup_stop_id ? (seqOf.get(row.pickup_stop_id) ?? 0) : 0
    const qty = Math.max(0, Math.floor(Number(row.quantity)))
    for (let n = 1; n <= qty; n++) {
      items.push({
        key: `${row.id}#${n}`,
        cargoItemId: row.id,
        label: row.label,
        l: Number(row.length_cm),
        w: Number(row.width_cm),
        h: Number(row.height_cm),
        weightKg: Number(row.weight_kg),
        unloadOrder,
        loadOrder,
        fragile: row.fragile,
        uprightOnly: row.upright_only,
        stackable: row.stackable,
        ...(row.max_top_load_kg !== null && row.max_top_load_kg !== undefined
          ? { maxTopLoadKg: Number(row.max_top_load_kg) }
          : {}),
      })
    }
  }
  return {
    container: {
      lengthCm: Number(truck.internal_length_cm),
      widthCm: Number(truck.internal_width_cm),
      heightCm: Number(truck.internal_height_cm),
      payloadKg: Number(truck.payload_kg),
    },
    items,
  }
}
