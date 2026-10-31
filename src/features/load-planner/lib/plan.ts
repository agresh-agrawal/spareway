// Pure helpers between saved plans, the engine result and the screen.
import type { PackContainer, PackMetrics, PackResult, Placement, UnplacedReason } from '@/types/domain'
import { computeWarnings } from '../engine'

interface PlanLike {
  engine_version: string
  input_hash: string
  placements: unknown
  unplaced: unknown
  metrics: unknown
}

/** A saved load_plans row → PackResult (warnings aren't stored; they are worked out again). */
export function resultFromRow(row: PlanLike, container: PackContainer): PackResult {
  const placements = (Array.isArray(row.placements) ? row.placements : []) as Placement[]
  const unplaced = (Array.isArray(row.unplaced) ? row.unplaced : []) as PackResult['unplaced']
  const metrics = (row.metrics ?? {}) as PackMetrics
  return {
    engineVersion: row.engine_version,
    inputHash: row.input_hash,
    placements,
    unplaced,
    metrics,
    warnings: computeWarnings(container, placements, metrics),
  }
}

interface CargoLike {
  id: string
  label: string
  client_name: string
  length_cm: number
  width_cm: number
  height_cm: number
  weight_kg: number
  drop_stop_id: string
}

export interface UnplacedGroup {
  cargoItemId: string
  label: string
  reason: UnplacedReason
  count: number
  kg: number
  m3: number
  size: [number, number, number]
  dropStopId: string | null
}

/** "Didn't fit" grouped by cargo row + reason (4 × Steel coils · Too heavy) in the order they came. */
export function groupUnplaced(unplaced: PackResult['unplaced'], cargo: CargoLike[]): UnplacedGroup[] {
  const rows = new Map(cargo.map((c) => [c.id, c]))
  const groups = new Map<string, UnplacedGroup>()
  for (const u of unplaced) {
    const id = u.key.split('#')[0]
    const row = rows.get(id)
    const k = `${id}|${u.reason}`
    const g =
      groups.get(k) ??
      ({
        cargoItemId: id,
        label: row?.label ?? u.label,
        reason: u.reason,
        count: 0,
        kg: 0,
        m3: 0,
        size: row ? [Number(row.length_cm), Number(row.width_cm), Number(row.height_cm)] : [0, 0, 0],
        dropStopId: row?.drop_stop_id ?? null,
      } satisfies UnplacedGroup)
    g.count += 1
    if (row) {
      g.kg += Number(row.weight_kg)
      g.m3 += (Number(row.length_cm) * Number(row.width_cm) * Number(row.height_cm)) / 1e6
    }
    groups.set(k, g)
  }
  return [...groups.values()]
}

/** Placements grouped by drop stop (unload order), with their step range, deepest stop first. */
export function placementsByStop(placements: Placement[]): {
  unloadOrder: number
  placements: Placement[]
  firstStep: number
  lastStep: number
  kg: number
}[] {
  const map = new Map<number, Placement[]>()
  for (const p of placements) map.set(p.unloadOrder, [...(map.get(p.unloadOrder) ?? []), p])
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([unloadOrder, list]) => ({
      unloadOrder,
      placements: list,
      firstStep: Math.min(...list.map((p) => p.step)),
      lastStep: Math.max(...list.map((p) => p.step)),
      kg: list.reduce((a, p) => a + p.weightKg, 0),
    }))
}

/** Free floor = truck length not used by any box. */
export function freeFloorCm(container: PackContainer, metrics: Pick<PackMetrics, 'usedLengthCm'>): number {
  return Math.max(0, container.lengthCm - (metrics.usedLengthCm ?? 0))
}

export type BoxState = 'planned' | 'done' | 'waiting' | 'issue'

/** Loading progress by placement key ('done' / 'issue' / 'waiting'); no progress → everything 'planned'. */
export function boxStates(progress: { placement_key: string; status: string }[]): Map<string, BoxState> {
  const out = new Map<string, BoxState>()
  if (progress.length === 0) return out
  const started = progress.some((p) => p.status !== 'pending')
  if (!started) return out
  for (const p of progress)
    out.set(p.placement_key, p.status === 'done' ? 'done' : p.status === 'issue' ? 'issue' : p.status === 'skipped' ? 'issue' : 'waiting')
  return out
}
