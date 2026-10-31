import { setupI18n } from '@/i18n/setup'
import { getModules, slotEntries } from '@/app/modules'
import { fixtureStore, resetFixtureStore } from '@/lib/fixtures'
import { createDriverLink, disableDriverLink, getDriverLinkState, getDriverTrip } from './api'

const DEMO = '00000000-0000-4000-8000-000000000031'
setupI18n('en')
beforeAll(() => window.history.replaceState(null, '', '/?fixture=seed'))
afterAll(() => window.history.replaceState(null, '', '/?fixture=off'))
beforeEach(() => resetFixtureStore(new Date('2026-10-31T06:00:00Z')))

describe('driver link', () => {
  it('owner makes a link; the driver sees stops, what to drop and the chosen route', async () => {
    expect(await getDriverLinkState(DEMO)).toEqual({ token: null, enabled: false })
    const token = await createDriverLink(DEMO)
    const d = await getDriverTrip(token)
    expect(d.trip.code).toBe('TRP-2026-0031')
    expect(d.truck.regNo).toBe('MP09 HG 4821')
    expect(d.stops.map((s) => s.seq)).toEqual([0, 1, 2, 3])
    expect(d.drops.reduce((n, x) => n + x.pieces, 0)).toBe(104)
    expect(d.route).toBeNull() // no route chosen yet → straight line on the page
  })
  it('turned off or wrong → LINK_INVALID', async () => {
    const token = await createDriverLink(DEMO)
    await disableDriverLink(DEMO)
    await expect(getDriverTrip(token)).rejects.toMatchObject({ code: 'LINK_INVALID' })
    await expect(getDriverTrip('nope')).rejects.toMatchObject({ code: 'LINK_INVALID' })
    expect(fixtureStore().trips.find((t) => t.id === DEMO)?.driver_link_enabled).toBe(false)
  })
  it('the trip page offers "Driver link" and /drive/:token needs no login', () => {
    const mods = getModules()
    expect(slotEntries(mods, 'trip.actions', { tripId: DEMO }).map((e) => e.id)).toContain('driver-link')
    expect(mods.find((m) => m.id === 'driver')?.publicRoutes?.[0]).toMatchObject({ path: '/drive/:token', guard: 'none' })
  })
})
