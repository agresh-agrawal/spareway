import type { PackContainer, PackItem, PackOptions, Placement } from '@/types/domain'
import { sha256Hex } from './sha256'

export const ENGINE_VERSION = 'sw-pack-2'

export interface ResolvedOptions {
  supportRatio: number
  heavyBelow: boolean
  epsilon: number
}

/** Defaults from Engineering Reference 1.4; supportRatio kept in (0, 1]. */
export function resolveOptions(o: PackOptions = {}): ResolvedOptions {
  const ratio = Number.isFinite(o.supportRatio) ? (o.supportRatio as number) : 1
  return {
    supportRatio: Math.min(1, Math.max(0.01, ratio)),
    heavyBelow: o.heavyBelow ?? true,
    epsilon: Number.isFinite(o.epsilon) && (o.epsilon as number) >= 0 ? (o.epsilon as number) : 0.5,
  }
}

const itemTuple = (i: PackItem) => [
  i.key,
  i.l,
  i.w,
  i.h,
  i.weightKg,
  i.unloadOrder,
  i.loadOrder ?? 0,
  i.fragile,
  i.uprightOnly,
  i.stackable,
  i.maxTopLoadKg ?? null,
]

const fixedTuple = (p: Placement) => [p.key, p.x, p.y, p.z, p.l, p.w, p.h, p.weightKg, p.unloadOrder, p.fragile, p.step]

/**
 * SHA-256 of the canonical input. Same truck, items (any order), options and engine → same hash,
 * so a saved plan can be reused instead of packing again. Labels don't change the packing and are left out.
 */
export function computeInputHash(
  container: PackContainer,
  items: PackItem[],
  options: PackOptions = {},
  fixed: Placement[] = [],
): string {
  const o = resolveOptions(options)
  const canonical = {
    v: ENGINE_VERSION,
    c: [container.lengthCm, container.widthCm, container.heightCm, container.payloadKg],
    o: [o.supportRatio, o.heavyBelow, o.epsilon],
    i: [...items].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)).map(itemTuple),
    f: [...fixed].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)).map(fixedTuple),
  }
  return sha256Hex(JSON.stringify(canonical))
}
