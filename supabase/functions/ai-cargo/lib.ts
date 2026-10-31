// Pure helpers for ai-cargo (Architecture F17/F18, Engineering Reference 6.2). No Deno / network here → tested with vitest.

export type Lang = 'en' | 'hi'

export interface ImageIn {
  base64: string
  mime: string
}

export interface Reference {
  name: string
  lengthCm: number
  widthCm: number
}

export type AiRequest =
  | { mode: 'image'; tripId: string | null; loaderToken: string | null; images: ImageIn[]; reference: Reference; lang: Lang }
  | { mode: 'voice'; tripId: string | null; loaderToken: string | null; transcript: string; lang: Lang }

export interface AiItem {
  label: string
  lengthCm: number
  widthCm: number
  heightCm: number
  quantity: number
  fragile: boolean
  uprightOnly: boolean
  stackable: boolean
  confidence: number
  notes: string
  countsPerView: number[]
}

export const MAX_IMAGES = 3
export const MAX_IMAGE_BYTES = 700 * 1024
export const A4: Reference = { name: 'A4 sheet', lengthCm: 29.7, widthCm: 21 }
const MIMES = ['image/jpeg', 'image/png', 'image/webp']

/** Bytes of a base64 string (without data: prefix). */
export function base64Bytes(b64: string): number {
  const s = b64.replace(/\s/g, '')
  const pad = s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0
  return Math.floor((s.length * 3) / 4) - pad
}

type Parsed = { ok: true; value: AiRequest } | { ok: false; code: 'BAD_REQUEST' | 'TOO_LARGE'; message: string }

const str = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null)

export function parseRequest(body: unknown): Parsed {
  if (!body || typeof body !== 'object') return { ok: false, code: 'BAD_REQUEST', message: 'Body must be an object' }
  const b = body as Record<string, unknown>
  const tripId = str(b.tripId)
  const loaderToken = str(b.loaderToken)
  if (!tripId && !loaderToken) return { ok: false, code: 'BAD_REQUEST', message: 'tripId or loaderToken needed' }
  const lang: Lang = b.lang === 'hi' ? 'hi' : 'en'

  if (b.mode === 'voice') {
    const transcript = str(b.transcript)
    if (!transcript || transcript.length > 1000) return { ok: false, code: 'BAD_REQUEST', message: 'transcript 1–1000 chars' }
    return { ok: true, value: { mode: 'voice', tripId, loaderToken, transcript, lang } }
  }
  if (b.mode !== 'image') return { ok: false, code: 'BAD_REQUEST', message: "mode must be 'image' or 'voice'" }

  if (!Array.isArray(b.images) || b.images.length < 1 || b.images.length > MAX_IMAGES)
    return { ok: false, code: 'BAD_REQUEST', message: `1–${MAX_IMAGES} images` }
  const images: ImageIn[] = []
  for (const raw of b.images) {
    const im = (raw ?? {}) as Record<string, unknown>
    const base64 = typeof im.base64 === 'string' ? im.base64.replace(/^data:[^,]+,/, '') : ''
    const mime = typeof im.mime === 'string' ? im.mime : ''
    if (!base64 || !MIMES.includes(mime)) return { ok: false, code: 'BAD_REQUEST', message: 'image needs base64 + jpeg/png/webp mime' }
    if (base64Bytes(base64) > MAX_IMAGE_BYTES) return { ok: false, code: 'TOO_LARGE', message: 'Each photo must be ≤ 700 KB' }
    images.push({ base64, mime })
  }
  const r = (b.reference ?? {}) as Record<string, unknown>
  const reference: Reference =
    typeof r.lengthCm === 'number' && typeof r.widthCm === 'number' && r.lengthCm > 0 && r.widthCm > 0
      ? { name: str(r.name) ?? 'reference', lengthCm: r.lengthCm, widthCm: r.widthCm }
      : A4
  return { ok: true, value: { mode: 'image', tripId, loaderToken, images, reference, lang } }
}

// ---------------- Gemini ----------------

/** responseSchema (Gemini OpenAPI subset) for { items: AiItem[] }. */
export const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          label: { type: 'STRING', description: 'Short English name of the goods, e.g. Carton, Refrigerator, Sack' },
          lengthCm: { type: 'NUMBER' },
          widthCm: { type: 'NUMBER' },
          heightCm: { type: 'NUMBER' },
          quantity: { type: 'INTEGER' },
          fragile: { type: 'BOOLEAN' },
          uprightOnly: { type: 'BOOLEAN' },
          stackable: { type: 'BOOLEAN' },
          confidence: { type: 'NUMBER', description: '0 to 1' },
          notes: { type: 'STRING' },
          countsPerView: { type: 'ARRAY', items: { type: 'INTEGER' }, description: 'count of this item seen in each photo, in photo order' },
        },
        required: ['label', 'lengthCm', 'widthCm', 'heightCm', 'quantity', 'fragile', 'uprightOnly', 'stackable', 'confidence', 'notes', 'countsPerView'],
      },
    },
  },
  required: ['items'],
}

export function imagePrompt(reference: Reference, count: number): string {
  return [
    'You help an Indian truck owner list cargo for loading.',
    `There ${count === 1 ? 'is 1 photo' : `are ${count} photos`} of the same goods from different sides.`,
    `A ${reference.name} (${reference.lengthCm} × ${reference.widthCm} cm) may lie next to the boxes — use it as the size scale.`,
    'Group identical items into one line. For each line give outer length, width and height in centimetres (bounding box),',
    'the total quantity (count each item once even if it appears in several photos), and countsPerView = how many you see in each photo.',
    'fragile = glass, TV, appliances, "fragile" marks; uprightOnly = "this side up" arrows or appliances; stackable = false if crushable or marked.',
    'confidence 0–1 for the size and count. If no reference is visible, lower the confidence and say so in notes.',
    'Never invent goods you cannot see. If nothing is visible, return an empty items list.',
  ].join(' ')
}

export function voicePrompt(transcript: string): string {
  return [
    'An Indian truck owner or loader described cargo by voice (Hindi, Hinglish or English). Turn it into item lines.',
    'Sizes are in cm unless the words say inch (इंच), feet (फुट) or metre. "A बाई B" / "A by B" means length × width; ऊँचाई / height is the height.',
    'Hindi numbers: डेढ़ 1.5, ढाई 2.5, सवा +0.25, साढ़े +0.5. नाज़ुक = fragile; सीधा रखें = uprightOnly; ऊपर कुछ न रखें = stackable false.',
    'Use 0 for any size that was not said (do not guess). quantity 1 if not said. countsPerView = [].',
    `Words: "${transcript.replace(/"/g, "'")}"`,
  ].join(' ')
}

export function geminiBody(req: AiRequest) {
  const parts: unknown[] =
    req.mode === 'image'
      ? [{ text: imagePrompt(req.reference, req.images.length) }, ...req.images.map((im) => ({ inlineData: { mimeType: im.mime, data: im.base64 } }))]
      : [{ text: voicePrompt(req.transcript) }]
  return {
    contents: [{ role: 'user', parts }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA, temperature: 0.1 },
  }
}

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : d)
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d)

/** Gemini generateContent reply → items (values kept as the model said them; only types are normalised). */
export function parseGemini(reply: unknown): AiItem[] | null {
  const r = reply as { candidates?: { content?: { parts?: { text?: string }[] } }[] } | null
  const text = r?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  if (!text) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''))
  } catch {
    return null
  }
  const list = (parsed as { items?: unknown })?.items
  if (!Array.isArray(list)) return null
  return list.map((raw) => {
    const it = (raw ?? {}) as Record<string, unknown>
    return {
      label: typeof it.label === 'string' && it.label.trim() ? it.label.trim().slice(0, 80) : 'Box',
      lengthCm: num(it.lengthCm),
      widthCm: num(it.widthCm),
      heightCm: num(it.heightCm),
      quantity: Math.max(1, Math.round(num(it.quantity, 1))),
      fragile: bool(it.fragile, false),
      uprightOnly: bool(it.uprightOnly, false),
      stackable: bool(it.stackable, true),
      confidence: Math.min(1, Math.max(0, num(it.confidence, 0.5))),
      notes: typeof it.notes === 'string' ? it.notes.slice(0, 300) : '',
      countsPerView: Array.isArray(it.countsPerView) ? it.countsPerView.map((n) => Math.round(num(n))).filter((n) => n >= 0) : [],
    }
  })
}

/** Plain warning codes the app shows next to the rows. */
export function warningsFor(items: AiItem[], mode: 'image' | 'voice'): string[] {
  const w = new Set<string>()
  if (items.length === 0) w.add('NOTHING_FOUND')
  for (const it of items) {
    const views = it.countsPerView.filter((n) => n > 0)
    if (views.length > 1 && new Set(views).size > 1) w.add('COUNT_MISMATCH')
    for (const s of [it.lengthCm, it.widthCm, it.heightCm]) {
      if (s === 0) w.add('SIZE_MISSING')
      else if (s < 5 || s > 400) w.add('SIZE_OUT_OF_RANGE')
    }
    if (mode === 'image' && it.confidence < 0.5) w.add('LOW_CONFIDENCE')
  }
  return [...w]
}
