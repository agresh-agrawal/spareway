import { setupI18n } from '@/i18n/setup'
import { AppError } from '@/lib/errors'
import { getModules, slotEntries } from '@/app/modules'
import { clearQueue, enqueue, readQueue, registerSender, replayQueue } from './lib/queue'
import { shouldSave } from './lib/persist'
import { corridorTiles, mapUrls, NH48, tileX, tileY } from './lib/mapCache'

const setOnline = (v: boolean) => Object.defineProperty(navigator, 'onLine', { value: v, configurable: true })

setupI18n('en')

describe('offline queue', () => {
  const sent: string[] = []
  let fail: ((p: { n: string }) => Error | null) | null = null
  registerSender<{ n: string }>('test', async (p) => {
    const err = fail?.(p)
    if (err) throw err
    sent.push(p.n)
  })

  beforeEach(() => {
    clearQueue()
    sent.length = 0
    fail = null
    setOnline(true)
  })
  afterAll(() => setOnline(true))

  it('replays in the order the taps were made', async () => {
    for (const n of ['a', 'b', 'c']) enqueue('test', { n })
    expect(await replayQueue()).toEqual({ sent: 3, dropped: [], left: 0 })
    expect(sent).toEqual(['a', 'b', 'c'])
    expect(readQueue()).toEqual([])
  })

  it('stops at a network failure and keeps the rest in order', async () => {
    for (const n of ['a', 'b', 'c']) enqueue('test', { n })
    fail = (p) => (p.n === 'b' ? new AppError('NETWORK') : null)
    expect(await replayQueue()).toMatchObject({ sent: 1, left: 2 })
    expect(readQueue().map((q) => (q.payload as { n: string }).n)).toEqual(['b', 'c'])
    fail = null
    await replayQueue()
    expect(sent).toEqual(['a', 'b', 'c'])
  })

  it('drops an item the server refuses (e.g. the plan changed) and goes on', async () => {
    for (const n of ['a', 'b', 'c']) enqueue('test', { n })
    fail = (p) => (p.n === 'b' ? new AppError('PLAN_CHANGED') : null)
    const r = await replayQueue()
    expect(r.sent).toBe(2)
    expect(r.dropped.map((d) => d.code)).toEqual(['PLAN_CHANGED'])
    expect(sent).toEqual(['a', 'c'])
  })

  it('keeps kinds that have no sender on this page', async () => {
    enqueue('other', { x: 1 })
    enqueue('test', { n: 'a' })
    expect(await replayQueue()).toMatchObject({ sent: 1, left: 1 })
    expect(readQueue()[0].kind).toBe('other')
  })

  it('cargo and loader register their senders', async () => {
    getModules()
    enqueue('cargo_add', { tripId: 't', values: {} })
    setOnline(false)
    // offline: the sender fails with no internet → kept
    expect((await replayQueue()).left).toBe(1)
  })
})

describe('saved data', () => {
  const q = (key: unknown[], status = 'success') => ({ queryKey: key, state: { status } }) as never
  it('keeps trips, plans and maps; never loader jobs, search or failed queries', () => {
    expect(shouldSave(q(['trip', 'x']))).toBe(true)
    expect(shouldSave(q(['pois', 'bbox']))).toBe(true)
    expect(shouldSave(q(['loaderJob', 'tok']))).toBe(false)
    expect(shouldSave(q(['search', 'mp09']))).toBe(false)
    expect(shouldSave(q(['trip', 'x'], 'error'))).toBe(false)
  })
})

describe('NH48 offline map', () => {
  it('tile math matches the slippy-map scheme', () => {
    expect([tileX(72.877, 11), tileY(19.076, 11)]).toEqual([1438, 913])
  })
  it('keeps the corridor up to z8 and a band along the road up to z11 (~570 tiles)', () => {
    const tiles = corridorTiles()
    expect(tiles.length).toBeGreaterThan(400)
    expect(tiles.length).toBeLessThan(800)
    for (const [lng, lat] of [NH48[0], NH48[NH48.length - 1]]) expect(tiles).toContain(`11/${tileX(lng, 11)}/${tileY(lat, 11)}`)
  })
  it('adds styles, sprites and Hindi glyphs', () => {
    const urls = mapUrls('https://t/{z}/{x}/{y}.pbf', [
      { sprite: 'https://s/ofm', glyphs: 'https://g/{fontstack}/{range}.pbf', layers: [{ layout: { 'text-font': ['Noto Sans Regular'] } }] },
    ])
    expect(urls).toEqual(expect.arrayContaining(['/map/spareway-dark.json', 'https://s/ofm@2x.png', 'https://g/Noto%20Sans%20Regular/2304-2559.pbf']))
  })
  it('Settings shows "Save map for offline"', () => {
    expect(slotEntries(getModules(), 'settings.sections', {}).map((e) => e.id)).toContain('offline-map')
  })
})
