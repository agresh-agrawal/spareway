import { emptyLoad, formErrors, loadFormSchema, offerWorth, roadKm, shipperSchema } from './lib/offer'
import { answerOffer, getProviderLink, getSharedLoad, makeOffer, postLoads } from './api'
import { toProviderLoad } from './lib/convert'
import { resetFixtureStore } from '@/lib/fixtures'
import { places } from '@/features/trips'

const good = { ...emptyLoad(), goods: 'Cartons', from: places[0].id, to: places[1].id, lengthCm: '60', widthCm: '40', heightCm: '40', weightKg: '12', quantity: '30', priceInr: '9000' }

describe('provider load form', () => {
  it('accepts a full load and turns it into numbers', () => {
    const r = loadFormSchema.safeParse(good)
    expect(r.success).toBe(true)
    expect(toProviderLoad(r.data!)).toMatchObject({ lengthCm: 60, quantity: 30, priceInr: 9000, pickupName: places[0].name })
  })
  it('says what to fix', () => {
    const e = formErrors(loadFormSchema.safeParse({ ...good, to: good.from, lengthCm: '2', priceInr: '' }))
    expect(e).toMatchObject({ to: 'provider:err.same', lengthCm: 'provider:err.size', priceInr: 'provider:err.price' })
    expect(formErrors(loadFormSchema.safeParse({ ...good, readyFrom: '2026-11-05', deliverBy: '2026-11-01' })).deliverBy).toBe('provider:err.dates')
    expect(shipperSchema.safeParse({ name: 'Sharma Traders', phone: '98270 11111' }).success).toBe(true)
    expect(shipperSchema.safeParse({ name: 'S', phone: '123' }).success).toBe(false)
  })
})

describe('offer calculator', () => {
  it('needs cost + minimum profit', () => {
    const w = offerWorth({ km: 300, costPerKmInr: 30, kg: 360, handlingInrPerKg: 0.5, minMarginInr: 500, offerInr: 9000 })
    expect(w).toEqual({ costInr: 9180, needInr: 9680, profitInr: -180, worth: false })
    expect(offerWorth({ km: 300, costPerKmInr: 30, kg: 360, handlingInrPerKg: 0.5, minMarginInr: 500, offerInr: 9680 }).worth).toBe(true)
  })
  it('road km is straight line × road factor', () => {
    expect(roadKm({ lat: 22.72, lng: 75.86 }, { lat: 18.52, lng: 73.86 }, 1.25)).toBeGreaterThan(560)
  })
})

describe('provider link → load → counter-offer (fixture)', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/?fixture=seed')
    resetFixtureStore()
  })
  it('posts loads with share links; accepting an offer reserves the load at that price', async () => {
    const token = await getProviderLink()
    const out = await postLoads(token, { name: 'Sharma Traders', phone: '98270 11111' }, [toProviderLoad(loadFormSchema.parse(good)), toProviderLoad(loadFormSchema.parse({ ...good, goods: 'Pipes' }))])
    expect(out).toHaveLength(2)
    expect(out[0].code).not.toBe(out[1].code)
    const before = await getSharedLoad(out[0].shareToken)
    expect(before.load).toMatchObject({ goods: 'Cartons', status: 'open', priceInr: 9000 })
    const { fixtureStore } = await import('@/lib/fixtures')
    const listing = fixtureStore().freight_listings.find((l) => l.share_token === out[0].shareToken)!
    await makeOffer(listing.id, 10500, 'Friday')
    const withOffer = await getSharedLoad(out[0].shareToken)
    expect(withOffer.offers[0]).toMatchObject({ amount: 10500, status: 'pending' })
    await answerOffer(out[0].shareToken, withOffer.offers[0].id, true)
    expect((await getSharedLoad(out[0].shareToken)).load).toMatchObject({ status: 'reserved', priceInr: 10500 })
    await expect(getProviderLink(true).then((t) => t !== token)).resolves.toBe(true)
  })
})
