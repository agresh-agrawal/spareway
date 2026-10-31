// Quick summary while the owner fills the truck form (owner request 5). Pure; every number comes from the form
// and the company's diesel price.

export interface GistInput {
  lengthCm: number
  widthCm: number
  heightCm: number
  payloadKg: number
  mileageKmpl: number
  costPerKmInr: number
  dieselInrPerL: number
}

export interface TruckGist {
  volumeM3: number
  volumeCft: number
  floorSqft: number
  /** standard 120 × 80 cm pallets on the floor */
  pallets: number
  /** 60 × 40 × 40 cm cartons, stacked to the roof */
  cartons: number
  /** goods heavier than this (kg per m³) fill the truck by weight before space */
  densityKgPerM3: number
  /** cost of a 500 km trip at the cost per km */
  cost500Inr: number
  /** diesel litres and ₹ for 500 km */
  diesel500L: number
  diesel500Inr: number
  /** ₹ per tonne-km when full by weight */
  perTonneKmInr: number | null
}

const fit = (a: number, b: number, x: number, y: number) =>
  Math.max(Math.floor(a / x) * Math.floor(b / y), Math.floor(a / y) * Math.floor(b / x))

/** null until the inside size is filled in. */
export function truckGist(i: GistInput): TruckGist | null {
  const { lengthCm: l, widthCm: w, heightCm: h } = i
  if (![l, w, h].every((v) => Number.isFinite(v) && v > 0)) return null
  const m3 = (l * w * h) / 1e6
  const payload = Number.isFinite(i.payloadKg) && i.payloadKg > 0 ? i.payloadKg : 0
  const cost = Number.isFinite(i.costPerKmInr) && i.costPerKmInr > 0 ? i.costPerKmInr : 0
  const litres = Number.isFinite(i.mileageKmpl) && i.mileageKmpl > 0 ? 500 / i.mileageKmpl : 0
  return {
    volumeM3: Math.round(m3 * 10) / 10,
    volumeCft: Math.round(m3 * 35.3147),
    floorSqft: Math.round((l * w) / 929.0304),
    pallets: fit(l, w, 120, 80),
    cartons: fit(l, w, 60, 40) * Math.floor(h / 40),
    densityKgPerM3: payload > 0 ? Math.round(payload / m3) : 0,
    cost500Inr: Math.round(cost * 500),
    diesel500L: Math.round(litres),
    diesel500Inr: Math.round(litres * i.dieselInrPerL),
    perTonneKmInr: payload > 0 && cost > 0 ? Math.round((cost / (payload / 1000)) * 100) / 100 : null,
  }
}
