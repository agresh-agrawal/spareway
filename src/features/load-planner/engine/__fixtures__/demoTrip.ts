// Engineering Reference 7 fixtures for the engine tests: the demo trip TRP-2026-0031 (7.1–7.3) built from the
// same seed fixture mode uses, plus an over-payload case with LD-1051 steel coils (7.4).
import { buildSeed } from '@/lib/fixtures'
import type { PackContainer, PackItem } from '@/types/domain'
import { buildPackItems, type CargoRowInput, type StopInput } from '../buildPackItems'

export function demoTripInput(): {
  container: PackContainer
  items: PackItem[]
  rows: CargoRowInput[]
  stops: StopInput[]
} {
  const d = buildSeed(new Date('2026-10-31T06:00:00Z'))
  const trip = d.trips.find((t) => t.code === 'TRP-2026-0031')!
  const truck = d.trucks.find((t) => t.id === trip.truck_id)!
  const stops = d.trip_stops.filter((s) => s.trip_id === trip.id)
  const rows = d.cargo_items.filter((c) => c.trip_id === trip.id)
  return { ...buildPackItems(rows, stops, truck), rows, stops }
}

/** Demo trip + 4 steel coils (150×150×120 cm, 4,000 kg each) for Mumbai: 16 t on a 15 t truck. */
export function overPayloadInput(): { container: PackContainer; items: PackItem[] } {
  const { container, items } = demoTripInput()
  const coils: PackItem[] = Array.from({ length: 4 }, (_, i) => ({
    key: `steel-coils#${i + 1}`,
    cargoItemId: 'steel-coils',
    label: 'Steel coils',
    l: 150,
    w: 150,
    h: 120,
    weightKg: 4000,
    unloadOrder: 3,
    loadOrder: 0,
    fragile: false,
    uprightOnly: false,
    stackable: true,
  }))
  return { container, items: [...items, ...coils] }
}

export const cube = (n: number, size: number, extra: Partial<PackItem> = {}): PackItem => ({
  key: `cube#${n}`,
  cargoItemId: 'cube',
  label: 'Cube',
  l: size,
  w: size,
  h: size,
  weightKg: 10,
  unloadOrder: 1,
  loadOrder: 0,
  fragile: false,
  uprightOnly: false,
  stackable: true,
  ...extra,
})
