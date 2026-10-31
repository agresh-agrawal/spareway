import type { PackContainer, PackItem, PackOptions, PackResult } from '@/types/domain'
import { resolveOptions } from './hash'
import { orientations } from './pack'

const ov = (a: number, al: number, b: number, bl: number) => Math.min(a + al, b + bl) - Math.max(a, b)

/**
 * Checks every rule on a finished plan, independent of how it was built. Returns readable problems
 * ([] = valid). Used by the tests on every result.
 */
export function validatePlan(
  container: PackContainer,
  items: PackItem[],
  result: PackResult,
  options: PackOptions = {},
): string[] {
  const o = resolveOptions(options)
  const e = o.epsilon
  const errors: string[] = []
  const byKey = new Map(items.map((i) => [i.key, i]))
  const P = result.placements

  // every item exactly once: placed or unplaced
  const seen = new Map<string, number>()
  for (const k of [...P.map((p) => p.key), ...result.unplaced.map((u) => u.key)]) seen.set(k, (seen.get(k) ?? 0) + 1)
  for (const i of items) if (seen.get(i.key) !== 1) errors.push(`${i.key} appears ${seen.get(i.key) ?? 0} times`)
  for (const k of seen.keys()) if (!byKey.has(k) && !P.find((p) => p.key === k && p.fixed)) errors.push(`${k} is not an input item`)

  // steps 1..n, unique
  const steps = P.map((p) => p.step).sort((a, b) => a - b)
  steps.forEach((s, i) => {
    if (s !== i + 1) errors.push(`steps not 1..n (got ${s} at ${i + 1})`)
  })

  let kg = 0
  for (const p of P) {
    kg += p.weightKg
    const it = byKey.get(p.key)
    if (it && !p.fixed) {
      const dims = orientations(it).find((d) => d.o === p.orientation)
      if (!dims || Math.abs(dims.l - p.l) > 1e-6 || Math.abs(dims.w - p.w) > 1e-6 || Math.abs(dims.h - p.h) > 1e-6)
        errors.push(`${p.key} has a wrong orientation`)
    }
    if (p.x < -e || p.y < -e || p.z < -e || p.x + p.l > container.lengthCm + e || p.y + p.w > container.widthCm + e || p.z + p.h > container.heightCm + e)
      errors.push(`${p.key} is outside the truck`)
  }
  if (kg > container.payloadKg + 1e-6) errors.push(`over payload: ${kg} > ${container.payloadKg}`)

  for (let i = 0; i < P.length; i++) {
    const a = P[i]
    const ia = byKey.get(a.key)
    const loadA = ia?.loadOrder ?? 0
    // overlap + order against every other box
    for (let j = 0; j < P.length; j++) {
      if (i === j) continue
      const b = P[j]
      const ib = byKey.get(b.key)
      const loadB = ib?.loadOrder ?? 0
      const oy = ov(a.y, a.w, b.y, b.w) > e
      const oz = ov(a.z, a.h, b.z, b.h) > e
      const ox = ov(a.x, a.l, b.x, b.l) > e
      if (j > i && ox && oy && oz) errors.push(`${a.key} overlaps ${b.key}`)
      // b between a and the doors while a leaves earlier (and b is already on board then) → blocked
      if (oy && oz && b.x >= a.x + a.l - e && b.unloadOrder > a.unloadOrder && loadB < a.unloadOrder)
        errors.push(`${b.key} blocks ${a.key} at unloading`)
      // b sits on a while a leaves earlier
      if (ox && oy && Math.abs(a.z + a.h - b.z) <= e && b.unloadOrder > a.unloadOrder) errors.push(`${b.key} sits on ${a.key}, which leaves earlier`)
      // b loaded earlier and in a's way at loading
      // (only while b is still on board when a is loaded)
      if (oy && oz && b.x >= a.x + a.l - e && loadB < loadA && b.unloadOrder > loadA && !(a.fixed && b.fixed))
        errors.push(`${b.key} blocks ${a.key} at loading`)
    }

    // support
    if (a.z > e) {
      let area = 0
      for (const b of P) {
        if (b === a || Math.abs(b.z + b.h - a.z) > e) continue
        const x = ov(a.x, a.l, b.x, b.l)
        const y = ov(a.y, a.w, b.y, b.w)
        if (x <= e || y <= e) continue
        const ib = byKey.get(b.key)
        if (!a.fixed || !b.fixed) {
          if (ib && (!ib.stackable || ib.fragile)) errors.push(`${a.key} rests on ${b.key}, which can't carry load`)
          if (o.heavyBelow && b.weightKg + 1e-9 < a.weightKg) errors.push(`${a.key} rests on lighter ${b.key}`)
          if (b.step > a.step) errors.push(`${a.key} is loaded before its support ${b.key}`)
        }
        area += x * y
      }
      if (area < o.supportRatio * a.l * a.w - e * (a.l + a.w)) errors.push(`${a.key} is not supported enough`)
    }
  }
  return errors
}
