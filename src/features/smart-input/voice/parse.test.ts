import { parseLengthAnswer, parseVoice, tokenize } from './parse'

type Want = { l?: number; w?: number; h?: number; q?: number; kg?: number; label?: string; fragile?: boolean; upright?: boolean; stack?: boolean; missing?: string[] }

// F18 test list (Engineering Reference: ≥ 25 sentences — Devanagari digits, डेढ़/ढाई/सवा/साढ़े, बाय/by/x, इंच, नाज़ुक)
const SENTENCES: [string, Want][] = [
  ['दस बाई दस का बॉक्स, ऊँचाई बीस, पचास पीस, नाज़ुक है', { l: 10, w: 10, h: 20, q: 50, fragile: true, label: 'Box' }],
  ['१० बाई १० बाई २० का डिब्बा, १०० पीस', { l: 10, w: 10, h: 20, q: 100 }],
  ['60 by 40 by 45 carton, 16 pieces', { l: 60, w: 40, h: 45, q: 16, label: 'Carton' }],
  ['60x40x45 cm, 16 boxes, 12 kg', { l: 60, w: 40, h: 45, q: 16, kg: 12 }],
  ['साठ बाय चालीस, ऊंचाई पैंतालीस, सोलह कार्टन', { l: 60, w: 40, h: 45, q: 16, label: 'Carton' }],
  ['डेढ़ फुट बाई एक फुट का बॉक्स, ऊँचाई एक फुट, बीस पीस', { l: 45.7, w: 30.5, h: 30.5, q: 20 }],
  ['ढाई फुट बाई दो फुट बाई दो फुट, दस नग', { l: 76.2, w: 61, h: 61, q: 10 }],
  ['सवा दो फुट बाई डेढ़ फुट, ऊंचाई एक फुट', { l: 68.6, w: 45.7, h: 30.5, q: 1 }],
  ['साढ़े तीन फुट बाई दो फुट बाई ढाई फुट का फ्रिज, सीधा रखें', { l: 106.7, w: 61, h: 76.2, label: 'Refrigerator', upright: true }],
  ['24 इंच बाई 18 इंच बाई 12 इंच, 30 पीस', { l: 61, w: 45.7, h: 30.5, q: 30 }],
  ['24 by 18 by 12 inch, 30 pcs', { l: 61, w: 45.7, h: 30.5, q: 30 }],
  ['दस बाई दस का बॉक्स, पचास पीस', { l: 10, w: 10, q: 50, missing: ['height'] }],
  ['ऊपर से दस बाई दस, ऊंचाई बीस, पचास पीस', { l: 10, w: 10, h: 20, q: 50, stack: true }],
  ['नीचे से 50 बाई 40, ऊँचाई 30, 8 पीस, ऊपर कुछ न रखें', { l: 50, w: 40, h: 30, q: 8, stack: false }],
  ['50 बाई 40 बाई 30, ऊपर कुछ मत रखो', { l: 50, w: 40, h: 30, stack: false }],
  ['das by das ka box, height bees, pachas piece, fragile hai', { l: 10, w: 10, h: 20, q: 50, fragile: true }],
  ['tees by bees by pandrah, chalis pieces, do not stack', { l: 30, w: 20, h: 15, q: 40, stack: false }],
  ['One hundred by fifty by forty, twenty five boxes, this side up', { l: 100, w: 50, h: 40, q: 25, upright: true }],
  ['दो सौ बाई सौ बाई पचास, दो पीस, वजन डेढ़ सौ किलो', { l: 200, w: 100, h: 50, q: 2, kg: 150 }],
  ['बोरी 90 बाई 50 बाई 25, सौ बोरी, हर एक 50 किलो', { l: 90, w: 50, h: 25, q: 100, kg: 50, label: 'Sack' }],
  ['1.2 मीटर बाई 1 मीटर बाई 80 सेमी, 4 पेटी', { l: 120, w: 100, h: 80, q: 4, label: 'Crate' }],
  ['20 ऊँचा, 30 बाई 30, 12 पीस', { l: 30, w: 30, h: 20, q: 12 }],
  ['लंबाई 80 चौड़ाई 60 ऊँचाई 40, 5 पीस, काँच का सामान', { l: 80, w: 60, h: 40, q: 5, fragile: true }],
  ['quantity 40, 45 by 35 by 30 cm, weight 8 kg', { l: 45, w: 35, h: 30, q: 40, kg: 8 }],
  ['पौने दो फुट बाई सवा फुट बाई एक फुट, बीस डिब्बे', { l: 53.3, w: 38.1, h: 30.5, q: 20 }],
  ['टीवी 110 बाई 20 बाई 70, नाजुक, सीधा रखना, 6 पीस', { l: 110, w: 20, h: 70, q: 6, label: 'TV', fragile: true, upright: true }],
  ['ड्रम 60 बाई 60 बाई 90, 10 ड्रम, 1 टन', { l: 60, w: 60, h: 90, q: 10, kg: 1000, label: 'Drum' }],
]

describe('parseVoice — sentences', () => {
  it('has at least 25 sentences', () => expect(SENTENCES.length).toBeGreaterThanOrEqual(25))
  it.each(SENTENCES)('%s', (sentence, want) => {
    const r = parseVoice(sentence)
    expect(r.items).toHaveLength(1)
    const it = r.items[0]
    if (want.l !== undefined) expect(it.lengthCm).toBe(want.l)
    if (want.w !== undefined) expect(it.widthCm).toBe(want.w)
    if (want.h !== undefined) expect(it.heightCm).toBe(want.h)
    expect(it.quantity).toBe(want.q ?? 1)
    if (want.kg !== undefined) expect(it.weightKg).toBe(want.kg)
    if (want.label) expect(it.label).toBe(want.label)
    expect(it.fragile).toBe(want.fragile ?? false)
    expect(it.uprightOnly).toBe(want.upright ?? false)
    expect(it.stackable).toBe(want.stack ?? true)
    expect(r.missing).toEqual(want.missing ?? [])
    expect(it.source).toBe('voice')
  })
})

describe('parseVoice — several items, missing values, nonsense', () => {
  it('splits two items at और', () => {
    const r = parseVoice('60 बाई 40 बाई 45, 16 पीस और 30 बाई 30 बाई 30, 10 पीस नाज़ुक')
    expect(r.items.map((i) => [i.lengthCm, i.quantity, i.fragile])).toEqual([
      [60, 16, false],
      [30, 10, true],
    ])
  })
  it('does not split when the second part has no size', () => {
    expect(parseVoice('50 बाई 40 बाई 30 और 8 पीस').items).toHaveLength(1)
  })
  it('missing height is reported, never guessed', () => {
    const r = parseVoice('दस बाई दस, पचास पीस')
    expect(r.items[0].heightCm).toBe(0)
    expect(r.missing).toEqual(['height'])
  })
  it('no sizes at all → unsure (ask AI or type)', () => {
    const r = parseVoice('कुछ बॉक्स हैं')
    expect(r.unsure).toBe(true)
    expect(r.missing).toEqual(['length', 'width', 'height'])
  })
  it('a stray number makes it unsure', () => {
    expect(parseVoice('10 बाई 10 बाई 10, 7 और 9').unsure).toBe(true)
  })
  it('empty → no items', () => {
    expect(parseVoice('   ').items).toEqual([])
  })
})

describe('helpers', () => {
  it('folds number words', () => {
    expect(tokenize('दो सौ पचास').map((t) => t.n)).toEqual([250])
    expect(tokenize('साढ़े तीन').map((t) => t.n)).toEqual([3.5])
    expect(tokenize('twenty five').map((t) => t.n)).toEqual([25])
    expect(tokenize('do not').map((t) => t.n ?? t.w)).toEqual(['do', 'not'])
  })
  it.each([
    ['बीस', 20],
    ['2 फुट', 61],
    ['साढ़े तीन इंच', 8.9],
    ['३० सेमी', 30],
    ['पता नहीं', null],
  ])('answer %s → %s cm', (text, cm) => expect(parseLengthAnswer(text)).toBe(cm))
})
