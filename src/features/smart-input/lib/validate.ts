// Check items rows (Architecture F17): AI / voice suggestions become editable rows. Values are copied exactly as suggested —
// the validator only reports problems, it never changes a number.
import type { ParsedCargoItem } from '@/types/domain'

export interface CheckRow {
  key: string
  label: string
  lengthCm: number
  widthCm: number
  heightCm: number
  quantity: number
  /** kg each — NaN until someone types it */
  weightKg: number
  dropStopId: string
  fragile: boolean
  uprightOnly: boolean
  stackable: boolean
  confidence: number
  notes: string
  countsPerView: number[]
}

export type RowError = 'label' | 'size' | 'quantity' | 'weight' | 'drop'
export type RowWarning = 'sizeRange' | 'countMismatch' | 'lowConfidence'

export interface SuggestedItem extends Omit<ParsedCargoItem, 'source'> {
  countsPerView?: number[]
}

export const SIZE_OK = { min: 5, max: 400 } // cm — outside this the row asks "check this size"
const SIZE_HARD = { min: 1, max: 2000 } // same limits as the cargo form

export function toRows(items: SuggestedItem[], dropStopId = ''): CheckRow[] {
  return items.map((it, i) => ({
    key: `${Date.now()}-${i}`,
    label: it.label,
    lengthCm: it.lengthCm,
    widthCm: it.widthCm,
    heightCm: it.heightCm,
    quantity: it.quantity,
    weightKg: it.weightKg ?? Number.NaN,
    dropStopId,
    fragile: it.fragile,
    uprightOnly: it.uprightOnly,
    stackable: it.stackable,
    confidence: it.confidence,
    notes: it.notes,
    countsPerView: it.countsPerView ?? [],
  }))
}

const sizes = (r: CheckRow) => [r.lengthCm, r.widthCm, r.heightCm]

export function rowErrors(r: CheckRow): RowError[] {
  const e: RowError[] = []
  if (!r.label.trim()) e.push('label')
  if (sizes(r).some((s) => !Number.isFinite(s) || s < SIZE_HARD.min || s > SIZE_HARD.max)) e.push('size')
  if (!Number.isInteger(r.quantity) || r.quantity < 1 || r.quantity > 5000) e.push('quantity')
  if (!Number.isFinite(r.weightKg) || r.weightKg < 0.1 || r.weightKg > 30000) e.push('weight')
  if (!r.dropStopId) e.push('drop')
  return e
}

export function rowWarnings(r: CheckRow): RowWarning[] {
  const w: RowWarning[] = []
  if (sizes(r).some((s) => Number.isFinite(s) && s >= SIZE_HARD.min && (s < SIZE_OK.min || s > SIZE_OK.max))) w.push('sizeRange')
  const views = r.countsPerView.filter((n) => n > 0)
  if (views.length > 1 && new Set(views).size > 1) w.push('countMismatch')
  if (r.confidence < 0.5) w.push('lowConfidence')
  return w
}

export const allValid = (rows: CheckRow[]) => rows.length > 0 && rows.every((r) => rowErrors(r).length === 0)

/** Longest side ≤ max, keeping the shape (photo compression). */
export function fitSize(w: number, h: number, max = 1280): { w: number; h: number } {
  const s = Math.min(1, max / Math.max(w, h))
  return { w: Math.round(w * s), h: Math.round(h * s) }
}
