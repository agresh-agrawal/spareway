import type { PackContainer, PackMetrics, PackResult, Placement } from '@/types/domain'

const r1 = (v: number) => Math.round(v * 10) / 10
const r2 = (v: number) => Math.round(v * 100) / 100

/** Balance limits (DECISIONS.md): centre of the load along the length / across the width, in %. */
export const COG_X_RANGE: [number, number] = [15, 60]
/** A box this heavy resting in the upper half of the truck → HEAVY_HIGH. */
export const HEAVY_HIGH_KG = 40

export function computeMetrics(c: PackContainer, placements: Placement[], unplacedCount: number): PackMetrics {
  const truckVol = c.lengthCm * c.widthCm * c.heightCm
  let vol = 0
  let kg = 0
  let mx = 0
  let my = 0
  let usedLength = 0
  for (const p of placements) {
    vol += p.l * p.w * p.h
    kg += p.weightKg
    mx += p.weightKg * (p.x + p.l / 2)
    my += p.weightKg * (p.y + p.w / 2)
    usedLength = Math.max(usedLength, p.x + p.l)
  }
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
  const half = c.heightCm / 2
  if (placements.some((p) => p.weightKg >= HEAVY_HIGH_KG && p.z >= half))
    out.push({ code: 'HEAVY_HIGH', message: 'Heavy goods are high up — keep them on the floor' })
  return out
}
