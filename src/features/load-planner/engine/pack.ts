// Packing engine (Architecture F10). Pure, synchronous and deterministic: same input → same plan.
// Extreme-point placement (Crainic, Perboli & Tadei 2008). Coordinates in cm: x from the cab (0) to the
// doors, y across, z up. A box is valid only if it is inside the truck, overlaps nothing, keeps the truck
// under payload, rests on enough strong boxes (supportRatio of its base, on stackable non-fragile boxes at
// least as heavy) and respects stop order (nothing blocks or sits on goods that leave earlier).
import type { PackContainer, PackItem, PackOptions, PackResult, Placement, UnplacedReason } from '@/types/domain'
import { computeInputHash, ENGINE_VERSION, resolveOptions, type ResolvedOptions } from './hash'
import { computeMetrics, computeWarnings } from './metrics'

interface Box {
  key: string
  cargoItemId: string
  label: string
  x: number
  y: number
  z: number
  l: number
  w: number
  h: number
  orientation: number
  unloadOrder: number
  loadOrder: number
  weightKg: number
  fragile: boolean
  stackable: boolean
  maxTopLoadKg?: number
  topLoadKg: number
  fixed: boolean
  seq: number
  step?: number
}

type Point = [number, number, number]
type Fail = 'space' | 'support' | 'order'
const FAIL_RANK: Record<Fail, number> = { space: 0, support: 1, order: 2 }

interface Contact {
  box: Box
  area: number
}
type Check = { ok: true; contacts: Contact[]; area: number } | { ok: false; fail: Fail }

/** The 6 orientations (2 when upright only): 0 l·w·h · 1 w·l·h · 2 l·h·w · 3 h·l·w · 4 w·h·l · 5 h·w·l */
export function orientations(item: Pick<PackItem, 'l' | 'w' | 'h' | 'uprightOnly'>): { o: number; l: number; w: number; h: number }[] {
  const { l, w, h } = item
  const all = [
    { o: 0, l, w, h },
    { o: 1, l: w, w: l, h },
    { o: 2, l, w: h, h: w },
    { o: 3, l: h, w: l, h: w },
    { o: 4, l: w, w: h, h: l },
    { o: 5, l: h, w, h: l },
  ]
  const list = item.uprightOnly ? all.slice(0, 2) : all
  const seen = new Set<string>()
  return list.filter((d) => {
    const k = `${d.l}|${d.w}|${d.h}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/** Engine sort: unload order high → low, load order low → high, volume ↓, weight ↓, key ↑ */
export function sortItems(items: PackItem[]): PackItem[] {
  return [...items].sort(
    (a, b) =>
      b.unloadOrder - a.unloadOrder ||
      (a.loadOrder ?? 0) - (b.loadOrder ?? 0) ||
      b.l * b.w * b.h - a.l * a.w * a.h ||
      b.weightKg - a.weightKg ||
      (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  )
}

const overlap1 = (a: number, al: number, b: number, bl: number) => Math.min(a + al, b + bl) - Math.max(a, b)

class Packer {
  boxes: Box[] = []
  points: Point[] = [[0, 0, 0]]
  pointKeys = new Set<string>(['0|0|0'])
  weight = 0
  usedVolume = 0
  private readonly c: PackContainer
  private readonly o: ResolvedOptions

  constructor(c: PackContainer, o: ResolvedOptions) {
    this.c = c
    this.o = o
  }

  tooLarge(item: PackItem): boolean {
    const e = this.o.epsilon
    return !orientations(item).some(
      (d) => d.l <= this.c.lengthCm + e && d.w <= this.c.widthCm + e && d.h <= this.c.heightCm + e,
    )
  }

  overPayload(item: PackItem): boolean {
    return this.weight + item.weightKg > this.c.payloadKg + 1e-6
  }

  check(it: PackItem, x: number, y: number, z: number, l: number, w: number, h: number): Check {
    const e = this.o.epsilon
    const C = this.c
    if (x < -e || y < -e || z < -e || x + l > C.lengthCm + e || y + w > C.widthCm + e || z + h > C.heightCm + e)
      return { ok: false, fail: 'space' }
    for (const b of this.boxes) {
      if (overlap1(x, l, b.x, b.l) > e && overlap1(y, w, b.y, b.w) > e && overlap1(z, h, b.z, b.h) > e)
        return { ok: false, fail: 'space' }
    }

    // support
    const contacts: Contact[] = []
    let area = 0
    if (z > e) {
      for (const b of this.boxes) {
        if (Math.abs(b.z + b.h - z) > e) continue
        const ox = overlap1(x, l, b.x, b.l)
        const oy = overlap1(y, w, b.y, b.w)
        if (ox <= e || oy <= e) continue
        if (!b.stackable || b.fragile || (this.o.heavyBelow && b.weightKg + 1e-9 < it.weightKg))
          return { ok: false, fail: 'support' }
        contacts.push({ box: b, area: ox * oy })
        area += ox * oy
      }
      if (area < this.o.supportRatio * l * w - e * (l + w)) return { ok: false, fail: 'support' }
      for (const ct of contacts) {
        const max = ct.box.maxTopLoadKg
        if (max !== undefined && ct.box.topLoadKg + (it.weightKg * ct.area) / area > max + 1e-9)
          return { ok: false, fail: 'support' }
      }
    }

    // stop order: nothing may block or sit on goods that leave earlier / are loaded later
    const load = it.loadOrder ?? 0
    for (const b of this.boxes) {
      const oy = overlap1(y, w, b.y, b.w) > e
      if (!oy) continue
      const oz = overlap1(z, h, b.z, b.h) > e
      if (oz) {
        // a box only blocks another while both are on the truck (loaded before the other leaves)
        if (b.x >= x + l - e) {
          // b is between the new box and the doors
          if (b.unloadOrder > it.unloadOrder && b.loadOrder < it.unloadOrder) return { ok: false, fail: 'order' }
          if (b.loadOrder < load && b.unloadOrder > load) return { ok: false, fail: 'order' }
        } else if (x >= b.x + b.l - e) {
          // the new box is between b and the doors
          if (it.unloadOrder > b.unloadOrder && load < b.unloadOrder) return { ok: false, fail: 'order' }
          if (load < b.loadOrder && it.unloadOrder > b.loadOrder) return { ok: false, fail: 'order' }
        }
      }
      if (overlap1(x, l, b.x, b.l) > e) {
        if (Math.abs(b.z + b.h - z) <= e) {
          // the new box rests on b
          if (it.unloadOrder > b.unloadOrder || load < b.loadOrder) return { ok: false, fail: 'order' }
        } else if (Math.abs(z + h - b.z) <= e) {
          // b overhangs onto the new box
          if (b.unloadOrder > it.unloadOrder) return { ok: false, fail: 'order' }
        }
      }
    }
    return { ok: true, contacts, area }
  }

  place(box: Box, contacts: Contact[], area: number) {
    for (const ct of contacts) ct.box.topLoadKg += area > 0 ? (box.weightKg * ct.area) / area : 0
    this.boxes.push(box)
    this.weight += box.weightKg
    this.usedVolume += box.l * box.w * box.h
    this.updatePoints(box)
  }

  /** Add a box that is already in the truck (fitAdditional). */
  placeFixed(box: Box) {
    const e = this.o.epsilon
    if (box.z > e) {
      const contacts: Contact[] = []
      let area = 0
      for (const b of this.boxes) {
        if (Math.abs(b.z + b.h - box.z) > e) continue
        const ox = overlap1(box.x, box.l, b.x, b.l)
        const oy = overlap1(box.y, box.w, b.y, b.w)
        if (ox > e && oy > e) {
          contacts.push({ box: b, area: ox * oy })
          area += ox * oy
        }
      }
      this.place(box, contacts, area)
    } else this.place(box, [], 0)
  }

  private projZ(px: number, py: number, pz: number): number {
    const e = this.o.epsilon
    let best = 0
    for (const b of this.boxes) {
      const top = b.z + b.h
      if (top <= pz + e && px >= b.x - e && px < b.x + b.l - e && py >= b.y - e && py < b.y + b.w - e)
        best = Math.max(best, top)
    }
    return Math.min(best, pz)
  }

  private projX(px: number, py: number, pz: number): number {
    const e = this.o.epsilon
    let best = 0
    for (const b of this.boxes) {
      const end = b.x + b.l
      if (end <= px + e && py >= b.y - e && py < b.y + b.w - e && pz >= b.z - e && pz < b.z + b.h - e)
        best = Math.max(best, end)
    }
    return Math.min(best, px)
  }

  private projY(px: number, py: number, pz: number): number {
    const e = this.o.epsilon
    let best = 0
    for (const b of this.boxes) {
      const end = b.y + b.w
      if (end <= py + e && px >= b.x - e && px < b.x + b.l - e && pz >= b.z - e && pz < b.z + b.h - e)
        best = Math.max(best, end)
    }
    return Math.min(best, py)
  }

  private addPoint(p: Point) {
    const e = this.o.epsilon
    const C = this.c
    if (p[0] >= C.lengthCm - e || p[1] >= C.widthCm - e || p[2] >= C.heightCm - e) return
    const k = `${Math.round(p[0] * 100)}|${Math.round(p[1] * 100)}|${Math.round(p[2] * 100)}`
    if (this.pointKeys.has(k)) return
    this.pointKeys.add(k)
    this.points.push(p)
  }

  private updatePoints(b: Box) {
    const e = this.o.epsilon
    // points now covered by the box are gone
    this.points = this.points.filter((p) => {
      const inside =
        p[0] >= b.x - e && p[0] < b.x + b.l - e && p[1] >= b.y - e && p[1] < b.y + b.w - e && p[2] >= b.z - e && p[2] < b.z + b.h - e
      if (inside) this.pointKeys.delete(`${Math.round(p[0] * 100)}|${Math.round(p[1] * 100)}|${Math.round(p[2] * 100)}`)
      return !inside
    })
    const p1: Point = [b.x + b.l, b.y, b.z]
    const p2: Point = [b.x, b.y + b.w, b.z]
    const p3: Point = [b.x, b.y, b.z + b.h]
    this.addPoint(p1)
    this.addPoint([p1[0], this.projY(...p1), p1[2]])
    this.addPoint([p1[0], p1[1], this.projZ(...p1)])
    this.addPoint(p2)
    this.addPoint([this.projX(...p2), p2[1], p2[2]])
    this.addPoint([p2[0], p2[1], this.projZ(...p2)])
    this.addPoint(p3)
    this.addPoint([this.projX(...p3), p3[1], p3[2]])
    this.addPoint([p3[0], this.projY(...p3), p3[2]])
    // deepest first (towards the cab), then lowest, then from the left
    this.points.sort((a, c) => a[0] - c[0] || a[2] - c[2] || a[1] - c[1])
  }

  /** Best position for the item, or why there is none. */
  search(it: PackItem): { box: Box; contacts: Contact[]; area: number } | { fail: Fail } {
    const dims = orientations(it)
    let worst: Fail = 'space'
    for (const [x, y, z] of this.points) {
      let best: { d: (typeof dims)[number]; r: Extract<Check, { ok: true }> } | null = null
      for (const d of dims) {
        const r = this.check(it, x, y, z, d.l, d.w, d.h)
        if (r.ok) {
          if (!best || x + d.l < x + best.d.l) best = { d, r }
        } else if (FAIL_RANK[r.fail] > FAIL_RANK[worst]) worst = r.fail
      }
      if (best) {
        const { d, r } = best
        return {
          box: {
            key: it.key,
            cargoItemId: it.cargoItemId,
            label: it.label,
            x,
            y,
            z,
            l: d.l,
            w: d.w,
            h: d.h,
            orientation: d.o,
            unloadOrder: it.unloadOrder,
            loadOrder: it.loadOrder ?? 0,
            weightKg: it.weightKg,
            fragile: it.fragile,
            stackable: it.stackable,
            ...(it.maxTopLoadKg !== undefined ? { maxTopLoadKg: it.maxTopLoadKg } : {}),
            topLoadKg: 0,
            fixed: false,
            seq: this.boxes.length,
          },
          contacts: r.contacts,
          area: r.area,
        }
      }
    }
    return { fail: worst }
  }
}

function toPlacement(b: Box, step: number): Placement {
  return {
    key: b.key,
    cargoItemId: b.cargoItemId,
    label: b.label,
    x: b.x,
    y: b.y,
    z: b.z,
    l: b.l,
    w: b.w,
    h: b.h,
    orientation: b.orientation,
    unloadOrder: b.unloadOrder,
    weightKg: b.weightKg,
    fragile: b.fragile,
    step,
    ...(b.fixed ? { fixed: true } : {}),
  }
}

function run(
  container: PackContainer,
  items: PackItem[],
  options: PackOptions,
  fixed: Placement[],
  inputHash: string,
): PackResult {
  const o = resolveOptions(options)
  const packer = new Packer(container, o)
  const info = new Map(items.map((i) => [i.key, i]))
  const fixedKeys = new Set(fixed.map((p) => p.key))

  // boxes already in the truck keep their place; unknown ones are treated as "don't stack"
  for (const p of [...fixed].sort((a, b) => a.step - b.step)) {
    const it = info.get(p.key)
    packer.placeFixed({
      key: p.key,
      cargoItemId: p.cargoItemId,
      label: p.label,
      x: p.x,
      y: p.y,
      z: p.z,
      l: p.l,
      w: p.w,
      h: p.h,
      orientation: p.orientation,
      unloadOrder: p.unloadOrder,
      loadOrder: 0,
      weightKg: p.weightKg,
      fragile: p.fragile,
      stackable: it ? it.stackable && !it.fragile : false,
      ...(it?.maxTopLoadKg !== undefined ? { maxTopLoadKg: it.maxTopLoadKg } : {}),
      topLoadKg: 0,
      fixed: true,
      seq: packer.boxes.length,
      step: p.step,
    })
  }

  const unplaced: PackResult['unplaced'] = []
  // identical units fail the same way while nothing new was placed → reuse the reason
  const failCache = new Map<string, { placed: number; reason: UnplacedReason }>()
  for (const it of sortItems(items.filter((i) => !fixedKeys.has(i.key)))) {
    let reason: UnplacedReason | null = null
    if (packer.tooLarge(it)) reason = 'TOO_LARGE'
    else if (packer.overPayload(it)) reason = 'OVER_PAYLOAD'
    else {
      const sig = `${it.cargoItemId}|${it.l}|${it.w}|${it.h}|${it.weightKg}`
      const cached = failCache.get(sig)
      if (cached && cached.placed === packer.boxes.length) reason = cached.reason
      else {
        const r = packer.search(it)
        if ('box' in r) packer.place(r.box, r.contacts, r.area)
        else {
          const freeVol = container.lengthCm * container.widthCm * container.heightCm - packer.usedVolume
          reason =
            r.fail === 'order'
              ? 'ORDER_CONFLICT'
              : r.fail === 'support' && freeVol >= it.l * it.w * it.h
                ? 'NO_SUPPORT'
                : 'NO_SPACE'
          failCache.set(sig, { placed: packer.boxes.length, reason })
        }
      }
    }
    if (reason) unplaced.push({ key: it.key, label: it.label, reason })
  }

  // loading steps: boxes already in keep theirs; new ones follow in load order, then placement order
  const fixedBoxes = packer.boxes.filter((b) => b.fixed)
  const newBoxes = packer.boxes.filter((b) => !b.fixed).sort((a, b) => a.loadOrder - b.loadOrder || a.seq - b.seq)
  let next = fixedBoxes.reduce((m, b) => Math.max(m, b.step ?? 0), 0)
  const placements = [
    ...fixedBoxes.map((b) => toPlacement(b, b.step ?? 0)),
    ...newBoxes.map((b) => toPlacement(b, ++next)),
  ].sort((a, b) => a.step - b.step)

  const metrics = computeMetrics(container, placements, unplaced.length)
  return {
    engineVersion: ENGINE_VERSION,
    inputHash,
    placements,
    unplaced,
    metrics,
    warnings: computeWarnings(container, placements, metrics),
  }
}

/** Pack every item into an empty truck. */
export function pack(container: PackContainer, items: PackItem[], options: PackOptions = {}): PackResult {
  return run(container, items, options, [], computeInputHash(container, items, options))
}

/**
 * Keep `fixed` boxes where they are (already loaded) and fit the other items around them.
 * `items` may include the fixed boxes' own items (matched by key) so the engine knows whether they can carry load.
 */
export function fitAdditional(
  container: PackContainer,
  fixed: Placement[],
  items: PackItem[],
  options: PackOptions = {},
): PackResult {
  return run(container, items, options, fixed, computeInputHash(container, items, options, fixed))
}
