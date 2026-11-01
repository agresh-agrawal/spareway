import type { PackContainer, PackMetrics, PackResult, Placement } from '@/types/domain'

const r1 = (v: number) => Math.round(v * 10) / 10
const r2 = (v: number) => Math.round(v * 100) / 100

/** Balance limits (DECISIONS.md): centre of the load along the length / across the width, in %. */
export const COG_X_RANGE: [number, number] = [15, 60]
export const COG_Y_RANGE: [number, number] = [40, 60]
/** Where the balance pass puts a load that is outside COG_X_RANGE (a little ahead of the middle, over the axles). */
export const COG_X_TARGET = 40
/** A gap this long between the cab wall and the load → LOAD_GAP (tie it down or fill the gap). */
export const GAP_CM = 30
/** A box this heavy resting in the upper half of the truck → HEAVY_HIGH. */
export const HEAVY_HIGH_KG = 40

export function computeMetrics(c: PackContainer, placements: Placement[], unplacedCount: number): PackMetrics {
  const truckVol = c.lengthCm * c.widthCm * c.heightCm
  let vol = 0
  let kg = 0
  let mx = 0
  let my = 0
  let usedLength = 0
  let start = Infinity
  for (const p of placements) {
    vol += p.l * p.w * p.h
    kg += p.weightKg
    mx += p.weightKg * (p.x + p.l / 2)
    my += p.weightKg * (p.y + p.w / 2)
    usedLength = Math.max(usedLength, p.x + p.l)
    start = Math.min(start, p.x)
  }
  // floor the load takes up (a balanced load may start behind the cab; that floor is still free)
  if (placements.length > 0) usedLength -= start
  return {
    volumeUsedPct: truckVol > 0 ? r1((100 * vol) / truckVol) : 0,
    weightUsedPct: c.payloadKg > 0 ? r1((100 * kg) / c.payloadKg) : 0,
    usedLengthCm: r1(usedLength),
    freeVolumeM3: r2(Math.max(0, truckVol - vol) / 1e6),
    remainingPayloadKg: r1(c.payloadKg - kg),
    cogXPct: kg > 0 && c.lengthCm > 0 ? r1((100 * mx) / kg / c.lengthCm) : 50,
    cogYPct: kg > 0 && c.widthCm > 0 ? r1((100 * my) / kg / c.widthCm) : 50,
    itemCount: placements.length,
    unplacedCount,
  }
}

export function computeWarnings(c: PackContainer, placements: Placement[], m: PackMetrics): PackResult['warnings'] {
  const out: PackResult['warnings'] = []
  if (placements.length === 0) return out
  if (m.cogXPct > COG_X_RANGE[1])
    out.push({ code: 'COG_LONGITUDINAL', message: 'Too much weight at the door side — move heavy goods towards the cab' })
  else if (m.cogXPct < COG_X_RANGE[0])
    out.push({ code: 'COG_LONGITUDINAL', message: 'All the weight is right behind the cab — spread it along the truck' })
  if (m.cogYPct < COG_Y_RANGE[0] || m.cogYPct > COG_Y_RANGE[1])
    out.push({ code: 'COG_LATERAL', message: 'More weight on one side — move heavy goods to the middle' })
  const gap = Math.min(...placements.map((p) => p.x))
  const side = Math.min(...placements.map((p) => p.y), c.widthCm - Math.max(...placements.map((p) => p.y + p.w)))
  if (gap >= GAP_CM || side >= GAP_CM)
    out.push({
      code: 'LOAD_GAP',
      message:
        gap >= GAP_CM
          ? `Load starts ${Math.round(gap)} cm behind the cab so the weight sits over the axles — tie it down or fill the gap with empty crates`
          : 'Load stands in the middle with space at the sides — tie it down so it cannot slide',
    })
  const half = c.heightCm / 2
  if (placements.some((p) => p.weightKg >= HEAVY_HIGH_KG && p.z >= half))
    out.push({ code: 'HEAVY_HIGH', message: 'Heavy goods are high up — keep them on the floor' })
  return out
}
