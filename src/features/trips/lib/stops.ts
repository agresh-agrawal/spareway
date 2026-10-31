export interface StopLike {
  id: string
  seq: number
  stop_type: string
}

/**
 * Unload order per stop id: the origin is 0, then 1, 2, 3… in visiting order. Cargo for a stop with a
 * higher number is unloaded later, so the packing engine puts it deeper (near the cab).
 */
export function unloadOrderForStops(stops: StopLike[]): Record<string, number> {
  const out: Record<string, number> = {}
  let n = 0
  for (const s of [...stops].sort((a, b) => a.seq - b.seq)) {
    out[s.id] = s.stop_type === 'origin' ? 0 : ++n
  }
  return out
}

/** Move one item up (-1) or down (+1) in a list; out of range → unchanged. */
export function moveItem<T>(list: T[], index: number, dir: -1 | 1): T[] {
  const to = index + dir
  if (to < 0 || to >= list.length) return list
  const next = [...list]
  const [it] = next.splice(index, 1)
  next.splice(to, 0, it)
  return next
}

/** Next owner action for a trip status (big status button). */
export type TripAction = 'start_loading' | 'leave' | 'deliver' | null

export function nextAction(status: string): TripAction {
  if (status === 'planned') return 'start_loading'
  if (status === 'loading') return 'leave'
  if (status === 'in_transit') return 'deliver'
  return null
}
