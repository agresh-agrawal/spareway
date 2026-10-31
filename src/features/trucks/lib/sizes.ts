import { cmToFt, cmToIn, ftToCm, inToCm } from '@/lib/units'

export type SizeUnit = 'ft' | 'cm'

/** Value shown in a size field: ft with 2 decimals (trailing zeros dropped), cm as whole numbers. */
export function cmToDisplay(cm: number, unit: SizeUnit): string {
  if (!Number.isFinite(cm)) return ''
  return unit === 'ft' ? String(Math.round(cmToFt(cm) * 100) / 100) : String(Math.round(cm))
}

/** Typed value back to cm (whole cm). Empty / bad input → NaN. */
export function displayToCm(text: string, unit: SizeUnit): number {
  const n = Number(text.replace(',', '.'))
  if (text.trim() === '' || !Number.isFinite(n)) return NaN
  return unit === 'ft' ? ftToCm(n) : Math.round(n)
}

/** Cargo sizes: cm or inch (stored cm, 1 decimal for inch input). */
export function cargoToCm(text: string, unit: 'cm' | 'in'): number {
  const n = Number(text.replace(',', '.'))
  if (text.trim() === '' || !Number.isFinite(n)) return NaN
  return unit === 'in' ? inToCm(n) : Math.round(n * 10) / 10
}

export function cmToCargo(cm: number, unit: 'cm' | 'in'): string {
  if (!Number.isFinite(cm)) return ''
  return unit === 'in' ? String(Math.round(cmToIn(cm) * 10) / 10) : String(Math.round(cm * 10) / 10)
}
