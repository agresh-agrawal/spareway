import type { PackContainer, Placement } from '@/types/domain'

export type Along = 'cab' | 'middle' | 'door'
export type Across = 'left' | 'centre' | 'right'

export interface PositionWords {
  along: Along
  across: Across
  /** 1 = floor, 2 = 2nd layer, … */
  layer: number
}

const EPS = 0.5

/**
 * Where a box goes, in words (Architecture F13): x thirds from the cab (0) to the doors, y thirds across
 * (left / centre / right, standing at the doors looking in), z layers counted from the floor.
 */
export function positionWords(p: Placement, container: Pick<PackContainer, 'lengthCm' | 'widthCm'>, all: Placement[] = [p]): PositionWords {
  const cx = p.x + p.l / 2
  const cy = p.y + p.w / 2
  const along: Along = cx < container.lengthCm / 3 ? 'cab' : cx < (2 * container.lengthCm) / 3 ? 'middle' : 'door'
  const across: Across = cy < container.widthCm / 3 ? 'left' : cy < (2 * container.widthCm) / 3 ? 'centre' : 'right'
  return { along, across, layer: layerOf(p, layerBand(all)) }
}

/**
 * Layer height for this load: the usual (median) height of the boxes on the floor, 30–90 cm. Loaders think in a
 * few layers, not in every height a box happens to start at.
 */
export function layerBand(all: Placement[]): number {
  const floor = all.filter((q) => q.z < EPS).map((q) => q.h).sort((a, b) => a - b)
  const band = floor.length ? Math.min(90, Math.max(30, floor[Math.floor(floor.length / 2)])) : 60
  return band
}

/** 1 = floor, then one layer per band height. */
export function layerOf(p: Placement, band: number): number {
  return Math.floor((p.z + EPS) / band) + 1
}

/** How many layers the load has. */
export function layerCount(all: Placement[]): number {
  const band = layerBand(all)
  return Math.max(1, ...all.map((p) => layerOf(p, band)))
}

/** Poll every 5 s while visible (10 s in low-data mode); stop while the page is hidden. */
export function pollInterval(visible: boolean, lowData: boolean): number | false {
  if (!visible) return false
  return lowData ? 10_000 : 5_000
}

/** First step that still needs doing (pending or problem), else the last step. */
export function firstOpenStep(progress: { step: number; status: string }[]): number {
  const open = progress.filter((p) => p.status === 'pending').sort((a, b) => a.step - b.step)[0]
  if (open) return open.step
  return progress.length ? Math.max(...progress.map((p) => p.step)) : 1
}

/**
 * The boxes the loader can put in one go from `step` on: the next pending steps in order with the same goods,
 * same layer and same drop stop (e.g. "12 × Cartons on the floor") — one tap for all of them, not 12.
 */
export function sameRun(
  placements: Placement[],
  progress: { step: number; status: string }[],
  step: number,
  band: number,
  max = 60,
): number[] {
  const sorted = placements.slice().sort((a, b) => a.step - b.step)
  const first = sorted.find((p) => p.step === step)
  if (!first) return []
  const pending = new Set(progress.filter((x) => x.status === 'pending').map((x) => x.step))
  const out: number[] = []
  for (const p of sorted) {
    if (p.step < step) continue
    if (!pending.has(p.step)) {
      if (p.step === step) continue // the current one may be a re-tap of a problem box
      break
    }
    if (p.label !== first.label || p.unloadOrder !== first.unloadOrder || layerOf(p, band) !== layerOf(first, band)) break
    out.push(p.step)
    if (out.length >= max) break
  }
  return out
}

/** Pending steps on one layer, in loading order. */
export function pendingOnLayer(
  placements: Placement[],
  progress: { step: number; status: string }[],
  layer: number,
  band: number,
): number[] {
  const pending = new Set(progress.filter((x) => x.status === 'pending').map((x) => x.step))
  return placements
    .filter((p) => layerOf(p, band) === layer && pending.has(p.step))
    .map((p) => p.step)
    .sort((a, b) => a - b)
}
