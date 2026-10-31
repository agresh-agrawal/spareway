// Rule parser for spoken cargo (Architecture F18): Hindi, Hinglish and English → cargo lines.
// Handles Devanagari digits, number words (एक…सौ, डेढ़, ढाई, सवा, साढ़े, पौने), बाई/by/x/×, cm/सेमी/इंच/फुट/मीटर, kg/किलो/टन,
// नाज़ुक / सीधा रखें / ऊपर कुछ न रखें. "ऊपर से / नीचे से 10 बाई 10" = the box's top / base is 10 × 10 (length × width); height comes
// separately. Never guesses a missing size: it is reported in `missing` and the app asks for it.
import type { ParsedCargoItem, VoiceParseResult } from '@/types/domain'

type Dim = 'length' | 'width' | 'height'

/** Spelling-insensitive key: no nukta, chandrabindu → anusvara, no visarga, lower case. */
export function norm(s: string): string {
  return s
    .normalize('NFC')
    .replace(/़/g, '')
    .replace(/ँ/g, 'ं')
    .replace(/ः/g, '')
    .replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966))
    .toLowerCase()
}

const HI_1_100 =
  'एक दो तीन चार पांच छह सात आठ नौ दस ग्यारह बारह तेरह चौदह पंद्रह सोलह सत्रह अठारह उन्नीस बीस इक्कीस बाईस तेईस चौबीस पच्चीस छब्बीस सत्ताईस अट्ठाईस उनतीस तीस इकतीस बत्तीस तैंतीस चौंतीस पैंतीस छत्तीस सैंतीस अड़तीस उनतालीस चालीस इकतालीस बयालीस तैंतालीस चवालीस पैंतालीस छियालीस सैंतालीस अड़तालीस उनचास पचास इक्यावन बावन तिरपन चौवन पचपन छप्पन सत्तावन अट्ठावन उनसठ साठ इकसठ बासठ तिरसठ चौंसठ पैंसठ छियासठ सड़सठ अड़सठ उनहत्तर सत्तर इकहत्तर बहत्तर तिहत्तर चौहत्तर पचहत्तर छिहत्तर सतहत्तर अठहत्तर उन्यासी अस्सी इक्यासी बयासी तिरासी चौरासी पचासी छियासी सत्तासी अट्ठासी नवासी नब्बे इक्यानवे बानवे तिरानवे चौरानवे पचानवे छियानवे सत्तानवे अट्ठानवे निन्यानवे'.split(' ')

const EXTRA_WORDS: Record<string, number> = {
  // spelling variants
  पाँच: 5, छ: 6, छे: 6, छै: 6, सत्तरह: 17, उन्नीस: 19, पच्चिस: 25, पैंतिस: 35, पचपन: 55, पंचानवे: 95,
  // romanised Hindi (no "do" / "saath": they clash with English words, handled below)
  ek: 1, teen: 3, tin: 3, char: 4, chaar: 4, panch: 5, paanch: 5, chhe: 6, che: 6, chah: 6, saat: 7, sat: 7, aath: 8, ath: 8, nau: 9,
  das: 10, gyarah: 11, barah: 12, baarah: 12, terah: 13, chaudah: 14, pandrah: 15, solah: 16, satrah: 17, atharah: 18, unnis: 19,
  bees: 20, bis: 20, pachees: 25, pachis: 25, tees: 30, tis: 30, chalis: 40, chaalis: 40, pachas: 50, pachaas: 50, sattar: 70,
  assi: 80, nabbe: 90,
  // English
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
}

const NUM = new Map<string, number>()
HI_1_100.forEach((w, i) => NUM.set(norm(w), i + 1))
for (const [w, n] of Object.entries(EXTRA_WORDS)) NUM.set(norm(w), n)

const HALVES = new Map<string, number>([['डेढ', 1.5], ['dedh', 1.5], ['ढाई', 2.5], ['dhai', 2.5], ['adhai', 2.5]].map(([w, n]) => [norm(w as string), n as number]))
const PREFIX = new Map<string, number>([['सवा', 0.25], ['sava', 0.25], ['sawa', 0.25], ['साढे', 0.5], ['sadhe', 0.5], ['saadhe', 0.5], ['पौने', -0.25], ['paune', -0.25]].map(([w, n]) => [norm(w as string), n as number]))
const MULT = new Map<string, number>([['सौ', 100], ['sau', 100], ['hundred', 100], ['हजार', 1000], ['hazar', 1000], ['hajar', 1000], ['thousand', 1000]].map(([w, n]) => [norm(w as string), n as number]))

const set = (words: string) => new Set(words.split(' ').map(norm))
const BY = set('by बाई बाय बाइ into इनटू x × * गुणा')
const CM = set('cm सेमी सेंटीमीटर centimeter centimetre centimeters सेंटी cms')
const INCH = set('inch inches इंच in')
const FEET = set('फुट फीट feet foot ft फूट')
const METRE = set('मीटर meter metre meters metres mtr m')
const KG = set('kg kgs किलो kilo kilos केजी किलोग्राम kilogram kilograms')
const TON = set('टन ton tons tonne tonnes')
const QTY_AFTER = set('पीस piece pieces pcs pc नग नंग बॉक्स box boxes डिब्बे डिब्बा कार्टन carton cartons बोरी बोरे bag bags sack sacks पेटी पेटियां crate crates ड्रम drum drums यूनिट unit units पैकेट packet packets item items आइटम')
const QTY_BEFORE = set('quantity qty संख्या गिनती total कुल')
const HEIGHT = set('ऊंचाई उंचाई ऊंचा उंचा height hight unchai oonchai उचाई')
const LENGTH = set('लंबाई लम्बाई length lambai लंबा')
const WIDTH = set('चौडाई चौड़ाई width chaudai चौडा')
const WEIGHT = set('वजन वज़न weight wajan vajan भार')
const SPLIT = set('और aur and फिर phir तथा')
const LABELS: [Set<string>, string][] = [
  [set('फ्रिज fridge refrigerator रेफ्रिजरेटर'), 'Refrigerator'],
  [set('टीवी tv television'), 'TV'],
  [set('कार्टन carton cartons'), 'Carton'],
  [set('पेटी पेटियां crate crates'), 'Crate'],
  [set('बोरी बोरे bag bags sack sacks'), 'Sack'],
  [set('ड्रम drum drums'), 'Drum'],
  [set('बॉक्स box boxes डिब्बा डिब्बे'), 'Box'],
]

const FRAGILE = /नाजुक|fragile|कांच|काच|glass|nazuk|najuk|टूटने/
const UPRIGHT = /सीधा|सीधे|upright|this side up|खडा रख|seedha|sidha/
const NO_STACK = /ऊपर (कुछ )?(न|मत|नहीं)|उपर (कुछ )?(न|मत|नहीं)|(don'?t|do not|no|not) stack|stack (मत|न|नहीं)|upar (kuch )?(na|mat|nahi)|not stackable|non.?stackable/

type Tok = { n: number; w?: undefined } | { w: string; n?: undefined }

/** Words → tokens, number words folded into numbers (दो सौ पचास → 250, साढ़े तीन → 3.5, twenty five → 25). */
export function tokenize(text: string): Tok[] {
  const t = norm(text).replace(/(\d)\s*[x×*]\s*(?=\d)/g, '$1 by ')
  const raw = t.match(/\d+(?:\.\d+)?|[,!?;:।]|[^\s,.!?;:'"()\d।-]+/g) ?? []
  const out: Tok[] = []
  let joinable = false // number words fold only with the word right before them ("दो सौ", not "25, सौ")
  for (let i = 0; i < raw.length; i++) {
    const w = raw[i]
    const next = raw[i + 1]
    if (/^[,!?;:।]$/.test(w)) {
      joinable = false
      continue
    }
    let n: number | undefined
    if (/^\d/.test(w)) n = Number(w)
    else if (NUM.has(w)) n = NUM.get(w)
    else if (w === 'do' && next !== 'not') n = 2
    else if (HALVES.has(w)) n = HALVES.get(w)
    else if (PREFIX.has(w)) {
      const nx = next !== undefined ? (/^\d/.test(next) ? Number(next) : NUM.get(next)) : undefined
      if (nx !== undefined) {
        n = nx + PREFIX.get(w)!
        i++
      } else n = 1 + PREFIX.get(w)! // "सवा फुट" = 1¼ ft
    } else if (MULT.has(w)) n = MULT.get(w)
    if (n === undefined) {
      out.push({ w })
      joinable = false
      continue
    }
    const isWord = !/^\d/.test(w)
    const prev = joinable ? out[out.length - 1] : undefined
    if (prev?.n !== undefined && MULT.has(w)) prev.n = prev.n * MULT.get(w)!
    else if (prev?.n !== undefined && prev.n >= 100 && prev.n % 100 === 0 && n < 100 && isWord) prev.n += n
    else if (prev?.n !== undefined && prev.n >= 20 && prev.n % 10 === 0 && prev.n < 100 && n < 10 && /^[a-z]+$/.test(w)) prev.n += n
    else out.push({ n })
    joinable = isWord
  }
  return out
}

function lengthFactor(w: string | undefined): number | null {
  if (!w) return null
  if (CM.has(w)) return 1
  if (INCH.has(w)) return 2.54
  if (FEET.has(w)) return 30.48
  if (METRE.has(w)) return 100
  return null
}

const r1 = (v: number) => Math.round(v * 10) / 10

function parseSegment(text: string): { item: ParsedCargoItem; missing: Dim[]; unsure: boolean } {
  const toks = tokenize(text)
  const used = new Set<number>()
  const dims: Partial<Record<Dim, number>> = {}
  let quantity: number | undefined
  let weightKg: number | undefined
  let unsure = false

  // "A by B (by C)" groups → length × width (× height); a unit after the group or after each number applies
  for (let i = 0; i < toks.length; i++) {
    if (toks[i].n === undefined || used.has(i)) continue
    const group = [i]
    let j = i
    while (true) {
      let k = j + 1
      if (toks[k] && lengthFactor(toks[k].w) !== null) k++ // "10 inch by 10 inch"
      if (toks[k]?.w && BY.has(toks[k].w!) && toks[k + 1]?.n !== undefined) {
        group.push(k + 1)
        j = k + 1
      } else break
    }
    if (group.length < 2) continue
    const after = lengthFactor(toks[j + 1]?.w)
    const factors = group.map((g) => lengthFactor(toks[g + 1]?.w) ?? after ?? 1)
    const names: Dim[] = ['length', 'width', 'height']
    group.slice(0, 3).forEach((g, idx) => {
      if (dims[names[idx]] === undefined) dims[names[idx]] = r1(toks[g].n! * factors[idx])
      used.add(g)
    })
    if (group.length > 3) unsure = true
    i = j
  }

  // number + unit word: 20 किलो → weight, 50 पीस → quantity
  toks.forEach((tk, i) => {
    if (tk.n === undefined || used.has(i)) return
    const nx = toks[i + 1]?.w ?? ''
    if (KG.has(nx) || TON.has(nx)) {
      if (weightKg === undefined) weightKg = tk.n * (TON.has(nx) ? 1000 : 1)
      used.add(i)
    } else if (QTY_AFTER.has(nx) && Number.isInteger(tk.n)) {
      if (quantity === undefined) quantity = tk.n
      used.add(i)
    }
  })

  // cue words (after the unit words, so "50 पीस" is never read as a height): ऊँचाई 20 / 20 ऊँचा, लंबाई…, वजन 20, quantity 50
  const numberNear = (i: number): number | null => {
    for (let k = i + 1; k <= i + 3 && k < toks.length; k++) if (toks[k].n !== undefined && !used.has(k)) return k
    if (toks[i - 1]?.n !== undefined && !used.has(i - 1)) return i - 1
    return null
  }
  toks.forEach((tk, i) => {
    if (!tk.w) return
    const dim: Dim | null = HEIGHT.has(tk.w) ? 'height' : LENGTH.has(tk.w) ? 'length' : WIDTH.has(tk.w) ? 'width' : null
    if (dim && dims[dim] === undefined) {
      const k = numberNear(i)
      if (k !== null) {
        dims[dim] = r1(toks[k].n! * (lengthFactor(toks[k + 1]?.w) ?? 1))
        used.add(k)
      }
    }
    if (WEIGHT.has(tk.w) && weightKg === undefined) {
      const k = numberNear(i)
      if (k !== null) {
        weightKg = toks[k].n! * (TON.has(toks[k + 1]?.w ?? '') ? 1000 : 1)
        used.add(k)
      }
    }
    if (QTY_BEFORE.has(tk.w) && quantity === undefined) {
      const k = numberNear(i)
      if (k !== null && k > i) {
        quantity = Math.round(toks[k].n!)
        used.add(k)
      }
    }
  })

  if (toks.some((tk, i) => tk.n !== undefined && !used.has(i))) unsure = true

  const words = toks.flatMap((tk) => (tk.w ? [tk.w] : []))
  const label = LABELS.find(([s]) => words.some((w) => s.has(w)))?.[1] ?? 'Box'
  const flat = norm(text)
  const missing = (['length', 'width', 'height'] as Dim[]).filter((d) => dims[d] === undefined)
  if (missing.length === 3) unsure = true
  const confidence = Math.max(0.2, 0.9 - (unsure ? 0.3 : 0) - missing.length * 0.1)

  return {
    item: {
      label,
      lengthCm: dims.length ?? 0,
      widthCm: dims.width ?? 0,
      heightCm: dims.height ?? 0,
      quantity: quantity ?? 1,
      ...(weightKg !== undefined ? { weightKg: r1(weightKg) } : {}),
      fragile: FRAGILE.test(flat),
      uprightOnly: UPRIGHT.test(flat),
      stackable: !NO_STACK.test(flat),
      confidence: Math.round(confidence * 100) / 100,
      notes: '',
      source: 'voice',
    },
    missing,
    unsure,
  }
}

const hasGroup = (text: string) => {
  const t = tokenize(text)
  return t.some((tk, i) => tk.w !== undefined && BY.has(tk.w) && t[i - 1]?.n !== undefined && t[i + 1]?.n !== undefined)
}

/** Split a sentence into item parts: at । ; new lines and और / and — but only where the next part has its own "A by B". */
export function splitItems(text: string): string[] {
  const parts: string[] = []
  for (const chunk of text.split(/[।;\n]+/)) {
    const words = chunk.trim().split(/\s+/)
    let cur: string[] = []
    for (const w of words) {
      if (SPLIT.has(norm(w)) && cur.length) {
        parts.push(cur.join(' '))
        cur = []
      } else cur.push(w)
    }
    if (cur.length) parts.push(cur.join(' '))
  }
  const merged: string[] = []
  for (const p of parts.filter((x) => x.trim())) {
    if (merged.length && !hasGroup(p)) merged[merged.length - 1] += ', ' + p
    else if (merged.length && !hasGroup(merged[merged.length - 1])) merged[merged.length - 1] += ', ' + p
    else merged.push(p)
  }
  return merged
}

export function parseVoice(transcript: string): VoiceParseResult {
  const parts = splitItems(transcript)
  if (parts.length === 0) return { items: [], missing: [], unsure: true, transcript }
  const results = parts.map(parseSegment)
  const missing = [...new Set(results.flatMap((r) => r.missing))]
  return { items: results.map((r) => r.item), missing, unsure: results.some((r) => r.unsure), transcript }
}

/** An answer to "ऊँचाई कितनी है?" → cm, e.g. "बीस", "2 फुट", "साढ़े तीन इंच". null if no number. */
export function parseLengthAnswer(text: string): number | null {
  const toks = tokenize(text)
  const i = toks.findIndex((t) => t.n !== undefined)
  if (i < 0) return null
  return r1(toks[i].n! * (lengthFactor(toks[i + 1]?.w) ?? 1))
}
