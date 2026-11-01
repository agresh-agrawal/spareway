// Cargo data checks (anti-poisoning). Pure. The same limits run in Postgres (trigger cargo_integrity_guard in
// supabase/sql/prephase4code_cargo_integrity.sql), so a client that skips this file is still refused there.
// AI and typed weights are only declared values: these checks compare them with physics (density), the truck,
// the company's own history and, when there is one, the weighbridge slip. Nothing here changes a number.

/** kg per m³ — above this nothing real fits (solid steel is ~7,850). Refused. */
export const DENSITY_MAX = 8000
/** kg per m³ — below this a box would be lighter than packing foam. Refused. */
export const DENSITY_MIN = 2
/** kg per m³ — heavier than stone or glass for its size: ask for proof. */
export const DENSITY_HIGH = 3000
/** kg per m³ — lighter than thermocol: ask for proof. */
export const DENSITY_LOW = 15
/** Same goods before: more than ±60 % from the usual weight each → ask. Needs 3 earlier lines. */
export const HISTORY_TOLERANCE = 0.6
export const HISTORY_MIN = 3
/** Weighbridge net vs declared: within ±10 % (at least 300 kg) counts as a match. */
export const WEIGH_TOLERANCE = 0.1
export const WEIGH_MIN_KG = 300
/** A weighing more than this far from the loading point does not prove this load. */
export const WEIGH_MAX_KM = 30

/** Words that say nothing about what is inside (en, Hinglish, hi). */
const VAGUE = new Set([
  'goods',
  'good',
  'item',
  'items',
  'box',
  'boxes',
  'carton',
  'cartons',
  'package',
  'packages',
  'parcel',
  'parcels',
  'misc',
  'miscellaneous',
  'other',
  'others',
  'stuff',
  'things',
  'material',
  'materials',
  'cargo',
  'load',
  'general',
  'test',
  'testing',
  'sample',
  'na',
  'n/a',
  'none',
  'xyz',
  'abc',
  'asdf',
  'qwerty',
  'unknown',
  'any',
  'etc',
  'maal',
  'saman',
  'samaan',
  'saamaan',
  'सामान',
  'माल',
  'डिब्बा',
  'डिब्बे',
  'पेटी',
  'कार्टन',
])

export type IntegrityBlock = 'DENSITY_IMPOSSIBLE_HIGH' | 'DENSITY_IMPOSSIBLE_LOW' | 'UNIT_OVER_PAYLOAD'
export type IntegrityFlag =
  | 'DENSITY_HIGH'
  | 'DENSITY_LOW'
  | 'LINE_OVER_PAYLOAD'
  | 'LINE_OVER_VOLUME'
  | 'NO_FIT'
  | 'VAGUE_LABEL'
  | 'HISTORY_MISMATCH'
  | 'LOW_AI_CONFIDENCE'

/** Flags that need a photo / document or an owner's reason before the plan is used. */
export const EVIDENCE_FLAGS: IntegrityFlag[] = [
  'DENSITY_HIGH',
  'DENSITY_LOW',
  'HISTORY_MISMATCH',
  'LOW_AI_CONFIDENCE',
]

export interface IntegrityItem {
  label: string
  length_cm: number
  width_cm: number
  height_cm: number
  weight_kg: number
  quantity: number
  upright_only?: boolean
  source?: string
  confidence?: number | null
}

export interface IntegrityTruck {
  lengthCm: number
  widthCm: number
  heightCm: number
  payloadKg: number
}

export interface IntegrityResult {
  /** kg per m³ of one unit */
  density: number
  blocks: IntegrityBlock[]
  flags: IntegrityFlag[]
  /** usual kg each for these goods in earlier trips, when known */
  historyKg: number | null
}

export const unitM3 = (c: Pick<IntegrityItem, 'length_cm' | 'width_cm' | 'height_cm'>) =>
  (Number(c.length_cm) * Number(c.width_cm) * Number(c.height_cm)) / 1e6

/** The label as a key for history: lower case, spaces and punctuation folded (Hindi vowel signs kept). Same as SQL _cargo_label_key. */
export const labelKey = (label: string) =>
  label
    .toLowerCase()
    .normalize('NFC')
    .replace(/[\s\p{P}\p{S}]+/gu, ' ')
    .trim()

export function isVagueLabel(label: string): boolean {
  const k = labelKey(label)
  if (k.replace(/\s/g, '').length < 3) return true
  if (/^\d+$/.test(k.replace(/\s/g, ''))) return true
  return k.split(' ').every((w) => VAGUE.has(w) || /^\d+$/.test(w))
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** Usual kg each for a label from earlier lines (other trips), or null with fewer than HISTORY_MIN. */
export function historyWeight(label: string, history: { label: string; weight_kg: number }[]): number | null {
  const k = labelKey(label)
  const ws = history
    .filter((h) => labelKey(h.label) === k)
    .map((h) => Number(h.weight_kg))
    .filter((w) => w > 0)
  return ws.length >= HISTORY_MIN ? median(ws) : null
}

function fits(c: IntegrityItem, t: IntegrityTruck): boolean {
  const { length_cm: l, width_cm: w, height_cm: h } = c
  const ok = (a: number, b: number, d: number) => a <= t.lengthCm && b <= t.widthCm && d <= t.heightCm
  if (c.upright_only) return ok(l, w, h) || ok(w, l, h)
  return [
    [l, w, h],
    [l, h, w],
    [w, l, h],
    [w, h, l],
    [h, l, w],
    [h, w, l],
  ].some(([a, b, d]) => ok(a, b, d))
}

/** Every check for one cargo line. `truck` and `history` are optional (provider form has neither). */
export function checkCargo(
  c: IntegrityItem,
  truck?: IntegrityTruck | null,
  history: { label: string; weight_kg: number }[] = [],
): IntegrityResult {
  const m3 = unitM3(c)
  const kg = Number(c.weight_kg)
  const qty = Number(c.quantity)
  const density = m3 > 0 ? kg / m3 : Number.POSITIVE_INFINITY
  const blocks: IntegrityBlock[] = []
  const flags: IntegrityFlag[] = []
  if (!(m3 > 0) || !(kg > 0)) return { density, blocks, flags, historyKg: null }

  if (density > DENSITY_MAX) blocks.push('DENSITY_IMPOSSIBLE_HIGH')
  else if (density > DENSITY_HIGH) flags.push('DENSITY_HIGH')
  if (density < DENSITY_MIN) blocks.push('DENSITY_IMPOSSIBLE_LOW')
  else if (density < DENSITY_LOW) flags.push('DENSITY_LOW')

  if (truck && truck.payloadKg > 0) {
    if (kg > truck.payloadKg) blocks.push('UNIT_OVER_PAYLOAD')
    else if (kg * qty > truck.payloadKg) flags.push('LINE_OVER_PAYLOAD')
    if (m3 * qty > (truck.lengthCm * truck.widthCm * truck.heightCm) / 1e6) flags.push('LINE_OVER_VOLUME')
    if (!fits(c, truck)) flags.push('NO_FIT')
  }
  if (isVagueLabel(c.label)) flags.push('VAGUE_LABEL')
  const historyKg = historyWeight(c.label, history)
  if (historyKg !== null && Math.abs(kg - historyKg) / historyKg > HISTORY_TOLERANCE)
    flags.push('HISTORY_MISMATCH')
  if ((c.source === 'camera' || c.source === 'voice') && c.confidence != null && Number(c.confidence) < 0.5)
    flags.push('LOW_AI_CONFIDENCE')
  return { density, blocks, flags, historyKg }
}

export const needsEvidence = (flags: readonly string[]) =>
  flags.some((f) => (EVIDENCE_FLAGS as string[]).includes(f))

export interface WeighingLike {
  status: string
}

/**
 * Data confidence 0–1 for one line (shown as "Estimated"): who declared it, how sure the AI was, what proof is
 * attached, and how it compares with the weighbridge. A line can never reach 1 — only a weighbridge measures.
 */
export function cargoConfidence(
  c: {
    source: string
    confidence?: number | null
    added_by_loader?: boolean
    integrity_flags?: readonly string[] | null
    evidence_path?: string | null
    image_path?: string | null
    integrity_confirmed_at?: string | null
  },
  weighing?: WeighingLike | null,
): number {
  const base: Record<string, number> = { manual: 0.7, csv: 0.65, seed: 0.7, voice: 0.6, extra_load: 0.6 }
  let s =
    c.source === 'camera' ? Math.min(0.85, 0.45 + 0.4 * Number(c.confidence ?? 0.5)) : (base[c.source] ?? 0.6)
  if (c.added_by_loader) s -= 0.05
  if (c.evidence_path || c.image_path) s += 0.1
  if (c.integrity_confirmed_at) s += 0.05
  const flags = c.integrity_flags ?? []
  s -= 0.15 * flags.filter((f) => (EVIDENCE_FLAGS as string[]).includes(f)).length
  s -= 0.05 * flags.filter((f) => !(EVIDENCE_FLAGS as string[]).includes(f)).length
  if (weighing?.status === 'match') s += 0.2
  if (weighing?.status === 'mismatch') s -= 0.3
  return Math.max(0.05, Math.min(0.97, Math.round(s * 100) / 100))
}

/** Weighbridge result: net = gross − tare, compared with the declared total. */
export function weighStatus(
  netKg: number,
  declaredKg: number,
): { diffKg: number; diffPct: number; match: boolean } {
  const diffKg = netKg - declaredKg
  const diffPct = declaredKg > 0 ? diffKg / declaredKg : 1
  return { diffKg, diffPct, match: Math.abs(diffKg) <= Math.max(WEIGH_TOLERANCE * declaredKg, WEIGH_MIN_KG) }
}

/** Empty truck weight when the slip has none: gross vehicle weight − payload (both from the truck record). */
export const defaultTareKg = (truck: { gross_weight_kg: number | null; payload_kg: number }) =>
  truck.gross_weight_kg && truck.gross_weight_kg > truck.payload_kg
    ? truck.gross_weight_kg - truck.payload_kg
    : null
