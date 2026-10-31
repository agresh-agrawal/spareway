export interface CargoLike {
  length_cm: number
  width_cm: number
  height_cm: number
  weight_kg: number
  quantity: number
}

/** Units Σqty · kg Σ(weight×qty) · m³ Σ(L×W×H×qty)/10⁶ (Architecture F9). */
export function cargoTotals(items: CargoLike[]): { units: number; kg: number; m3: number } {
  let units = 0
  let kg = 0
  let cm3 = 0
  for (const c of items) {
    const q = Number(c.quantity)
    units += q
    kg += Number(c.weight_kg) * q
    cm3 += Number(c.length_cm) * Number(c.width_cm) * Number(c.height_cm) * q
  }
  return { units, kg, m3: cm3 / 1e6 }
}

/** Booked share of the truck (before packing), in %. */
export function bookedPct(totals: { kg: number; m3: number }, truck: { payloadKg: number; volumeM3: number }) {
  return {
    weightPct: truck.payloadKg > 0 ? (100 * totals.kg) / truck.payloadKg : 0,
    spacePct: truck.volumeM3 > 0 ? (100 * totals.m3) / truck.volumeM3 : 0,
  }
}

/** Can one unit fit inside the truck in any allowed orientation? Keep-upright keeps the height. */
export function fitsTruck(
  item: { length_cm: number; width_cm: number; height_cm: number; upright_only: boolean },
  truck: { lengthCm: number; widthCm: number; heightCm: number },
): boolean {
  const { length_cm: l, width_cm: w, height_cm: h } = item
  const box = [truck.lengthCm, truck.widthCm, truck.heightCm]
  const ok = (a: number, b: number, c: number) => a <= box[0] && b <= box[1] && c <= box[2]
  if (item.upright_only) return ok(l, w, h) || ok(w, l, h)
  return [
    [l, w, h],
    [l, h, w],
    [w, l, h],
    [w, h, l],
    [h, l, w],
    [h, w, l],
  ].some(([a, b, c]) => ok(a, b, c))
}
