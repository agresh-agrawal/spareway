import { A4, base64Bytes, geminiBody, MAX_IMAGE_BYTES, parseGemini, parseRequest, warningsFor } from './lib'

const img = { base64: 'aGVsbG8=', mime: 'image/jpeg' }
const reply = (obj: unknown) => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] })

describe('ai-cargo request (Engineering Reference 6.2)', () => {
  it('accepts the image example and defaults to the A4 sheet', () => {
    const r = parseRequest({ mode: 'image', tripId: 't1', loaderToken: null, images: [img], lang: 'hi' })
    expect(r.ok && r.value).toMatchObject({ mode: 'image', tripId: 't1', lang: 'hi', reference: A4 })
  })
  it('accepts the voice example with a loader token', () => {
    const r = parseRequest({ mode: 'voice', loaderToken: '3f9c', transcript: 'दस बाई दस का बॉक्स', lang: 'hi' })
    expect(r.ok && r.value).toMatchObject({ mode: 'voice', loaderToken: '3f9c', tripId: null })
  })
  it('strips a data: prefix', () => {
    const r = parseRequest({ mode: 'image', tripId: 't1', images: [{ ...img, base64: `data:image/jpeg;base64,${img.base64}` }] })
    expect(r.ok && r.value.mode === 'image' && r.value.images[0].base64).toBe(img.base64)
  })
  it.each([
    [{ mode: 'image', images: [img] }],
    [{ mode: 'image', tripId: 't', images: [] }],
    [{ mode: 'image', tripId: 't', images: [img, img, img, img] }],
    [{ mode: 'image', tripId: 't', images: [{ base64: 'x', mime: 'image/gif' }] }],
    [{ mode: 'voice', tripId: 't', transcript: '  ' }],
    [{ mode: 'text', tripId: 't' }],
    [null],
  ])('rejects bad input %#', (b) => {
    expect(parseRequest(b)).toMatchObject({ ok: false, code: 'BAD_REQUEST' })
  })
  it('photos over 700 KB → TOO_LARGE', () => {
    const big = 'A'.repeat(Math.ceil((MAX_IMAGE_BYTES + 10) / 3) * 4)
    expect(base64Bytes(big)).toBeGreaterThan(MAX_IMAGE_BYTES)
    expect(parseRequest({ mode: 'image', tripId: 't', images: [{ base64: big, mime: 'image/jpeg' }] })).toMatchObject({ ok: false, code: 'TOO_LARGE' })
  })
})

describe('Gemini body and reply', () => {
  it('sends photos as inline data with a JSON schema', () => {
    const r = parseRequest({ mode: 'image', tripId: 't', images: [img, img] })
    const b = geminiBody(r.ok ? r.value : (null as never))
    expect(b.contents[0].parts).toHaveLength(3)
    expect(b.generationConfig.responseMimeType).toBe('application/json')
    expect(b.generationConfig.responseSchema.properties.items.items.required).toContain('countsPerView')
  })
  it('reads the 6.2 example reply and keeps the values', () => {
    const items = parseGemini(
      reply({ items: [{ label: 'Carton', lengthCm: 60, widthCm: 40, heightCm: 45, quantity: 16, fragile: false, uprightOnly: false, stackable: true, confidence: 0.82, notes: '', countsPerView: [16, 15] }] }),
    )
    expect(items).toEqual([
      { label: 'Carton', lengthCm: 60, widthCm: 40, heightCm: 45, quantity: 16, fragile: false, uprightOnly: false, stackable: true, confidence: 0.82, notes: '', countsPerView: [16, 15] },
    ])
    expect(warningsFor(items!, 'image')).toEqual(['COUNT_MISMATCH'])
  })
  it('accepts fenced JSON and fills missing fields safely', () => {
    const items = parseGemini({ candidates: [{ content: { parts: [{ text: '```json\n{"items":[{"lengthCm":"700","quantity":0}]}\n```' }] } }] })
    expect(items?.[0]).toMatchObject({ label: 'Box', lengthCm: 700, widthCm: 0, quantity: 1, stackable: true, confidence: 0.5 })
    expect(warningsFor(items!, 'voice')).toEqual(expect.arrayContaining(['SIZE_MISSING', 'SIZE_OUT_OF_RANGE']))
  })
  it('bad replies → null (AI_PARSE)', () => {
    expect(parseGemini(null)).toBeNull()
    expect(parseGemini(reply('nope'))).toBeNull()
    expect(parseGemini({ candidates: [{ content: { parts: [{ text: '{oops' }] } }] })).toBeNull()
  })
  it('nothing seen → NOTHING_FOUND', () => {
    expect(warningsFor(parseGemini(reply({ items: [] }))!, 'image')).toEqual(['NOTHING_FOUND'])
  })
})
