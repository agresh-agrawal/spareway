// Route step in fixture mode: mocked route-plan (Engineering Reference 6.1), real POIs, Choose writes the
// right fields; plus the route-plan contract, driver message and slot.
import type { ReactNode } from 'react'
import { act, fireEvent, renderHook, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fakeAuth, renderAt } from '@/test/renderWithAuth'
import { fixtureStore, resetFixtureStore } from '@/lib/fixtures'
import { applyLang } from '@/lib/i18n'
import { getModules, slotEntries } from '@/app/modules'
import i18n from '@/i18n/setup'
import { routePlanBody } from '../api'
import { departureFor, routesFitStops, useRoutePlanner } from '../hooks'
import { driverMessage, placeName, whatsappLink } from '../lib/journey'
import { RouteStep } from '../components/RouteStep'

vi.mock('@/lib/realtime', () => ({ useRealtime: () => {} }))
// MapLibre needs WebGL (not in jsdom); the map is a lazy chunk, stub it
vi.mock('../components/RouteMap', () => ({ default: () => <div data-testid="route-map" /> }))

const DEMO = '00000000-0000-4000-8000-000000000031'
const auth = fakeAuth({ status: 'ready' })

beforeAll(() => window.history.replaceState(null, '', '/?fixture=seed'))
afterAll(() => window.history.replaceState(null, '', '/?fixture=off'))
beforeEach(() => {
  resetFixtureStore(new Date('2026-10-31T06:00:00Z'))
  applyLang('en', false)
})

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useRoutePlanner (fixture mode)', () => {
  it('gets three routes once, saves them, plans and costs each, marks one Best; Choose writes the trip', async () => {
    const { result } = renderHook(() => useRoutePlanner(DEMO), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.status).toBe('ready'), { timeout: 8000 })
    const d = fixtureStore()
    expect(d.route_options.filter((r) => r.trip_id === DEMO).map((r) => r.variant)).toEqual(['fastest', 'shortest', 'no_tolls'])
    const routes = result.current.routes
    expect(routes).toHaveLength(3)
    expect(routes.filter((r) => r.best)).toHaveLength(1)
    const best = routes.find((r) => r.best)!
    expect(routes.every((r) => r.cost.score >= best.cost.score)).toBe(true)
    expect(result.current.selected).toBeUndefined()
    expect(result.current.departure).toBe(d.trips.find((t) => t.id === DEMO)!.planned_departure)

    // choose the route that waits for Mumbai no-entry hours
    const waiting = routes.find((r) => r.plan.schedule.warnings.some((w) => w.code === 'NO_ENTRY'))!
    await act(() => result.current.choose(waiting))
    const trip = d.trips.find((t) => t.id === DEMO)!
    expect(trip.selected_route_id).toBe(waiting.row.id)
    const rows = d.route_options.filter((r) => r.trip_id === DEMO)
    expect(rows.filter((r) => r.is_selected).map((r) => r.id)).toEqual([waiting.row.id])
    expect(rows.find((r) => r.id === waiting.row.id)).toMatchObject({
      total_cost_inr: waiting.cost.totalInr,
      toll_count: waiting.cost.tollCount,
      fuel_cost_inr: waiting.cost.fuelInr,
    })
    for (const e of waiting.plan.schedule.stopEtas) expect(d.trip_stops.find((s) => s.id === e.stopId)?.eta).toBe(e.eta)
    expect(d.activity_log.at(-1)).toMatchObject({ kind: 'route_chosen', meta: { code: 'TRP-2026-0031', variant: waiting.variant } })
    expect(d.alerts.some((a) => a.kind === 'city_entry' && !a.is_sample)).toBe(false) // no-entry waits stay on the route card
    await waitFor(() => expect(result.current.selected?.row.id).toBe(waiting.row.id))
  })

  it('reuses saved routes (no new request) and asks again when the stops changed', async () => {
    const first = renderHook(() => useRoutePlanner(DEMO), { wrapper: wrapper() })
    await waitFor(() => expect(first.result.current.status).toBe('ready'), { timeout: 8000 })
    const ids = fixtureStore().route_options.map((r) => r.id)
    first.unmount()

    const again = renderHook(() => useRoutePlanner(DEMO), { wrapper: wrapper() })
    await waitFor(() => expect(again.result.current.status).toBe('ready'), { timeout: 8000 })
    expect(fixtureStore().route_options.map((r) => r.id)).toEqual(ids)
    again.unmount()

    // move the last stop to Pune → old routes don't fit → fresh routes
    const last = fixtureStore().trip_stops.find((s) => s.trip_id === DEMO && s.seq === 3)!
    Object.assign(last, { name: 'Pune (Chakan)', city: 'Pune', lat: 18.7606, lng: 73.8636 })
    const moved = renderHook(() => useRoutePlanner(DEMO), { wrapper: wrapper() })
    await waitFor(() => expect(moved.result.current.status).toBe('ready'), { timeout: 8000 })
    expect(fixtureStore().route_options.map((r) => r.id)).not.toEqual(ids)
  })

  it('departure: the trip time, else tomorrow 6:00 am IST', () => {
    expect(departureFor('2026-11-01T00:30:00Z')).toBe('2026-11-01T00:30:00.000Z')
    expect(departureFor(null, new Date('2026-10-31T20:00:00Z'))).toBe('2026-11-02T00:30:00.000Z') // 1:30 am IST on 1 Nov → 2 Nov 6:00
    expect(departureFor(null, new Date('2026-10-31T06:00:00Z'))).toBe('2026-11-01T00:30:00.000Z')
  })

  it('routesFitStops: a line far from a stop does not fit', () => {
    const stops = [
      { seq: 0, lat: 26, lng: 76 },
      { seq: 1, lat: 26, lng: 77 },
    ]
    const line = { geometry: { type: 'LineString', coordinates: [[76, 26], [77, 26]] } } as never
    expect(routesFitStops([line], stops)).toBe(true)
    expect(routesFitStops([line], [...stops, { seq: 2, lat: 28, lng: 77 }])).toBe(false)
    expect(routesFitStops([], stops)).toBe(false)
  })
})

describe('route-plan contract (Architecture 9.1)', () => {
  it('request body for the demo trip', () => {
    const d = fixtureStore()
    const trip = d.trips.find((t) => t.id === DEMO)!
    const truck = d.trucks.find((t) => t.id === trip.truck_id)!
    const body = routePlanBody(trip, truck, d.trip_stops.filter((s) => s.trip_id === DEMO))
    expect(body).toEqual({
      tripId: DEMO,
      coordinates: [
        [76.9366, 28.354],
        [75.8306, 26.7787],
        [72.5947, 22.9536],
        [73.0483, 19.2813],
      ],
      variants: ['fastest', 'shortest', 'no_tolls'],
      truck: { lengthM: 9.75, widthM: 2.43, heightM: 2.43, weightT: 31, axleloadT: 10.3 },
    })
  })
})

describe('Route step screen (fixture mode)', () => {
  it('three route cards, one lime Choose on Best, journey; Choose → driver message with WhatsApp', async () => {
    renderAt(<RouteStep tripId={DEMO} />, { path: '/', at: '/', auth })
    const cards = await screen.findAllByRole('article', undefined, { timeout: 8000 })
    expect(cards.map((c) => within(c).getByRole('heading').textContent)).toEqual(['Fastest', 'Shortest', 'No tolls'])
    expect(screen.getAllByText('Best')).toHaveLength(1)
    expect(screen.getByText(/^Leaves /)).toBeInTheDocument()
    expect(screen.getByText('Journey')).toBeInTheDocument()
    expect(screen.getByText('Choose a route to send it to the driver')).toBeInTheDocument()
    const bestCard = cards.find((c) => within(c).queryByText('Best'))!
    fireEvent.click(within(bestCard).getByRole('button', { name: /Choose/ }))
    const send = await screen.findByRole('link', { name: /Send on WhatsApp/ })
    expect(send.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/919827000001\?text=/)
    // Hindi by default for the driver
    expect(decodeURIComponent(send.getAttribute('href')!)).toContain('नमस्ते रमेश यादव')
    fireEvent.click(screen.getByRole('button', { name: 'English' }))
    expect(decodeURIComponent(screen.getByRole('link', { name: /Send on WhatsApp/ }).getAttribute('href')!)).toContain('Namaste Ramesh Yadav')
  })

  it('switches to Hindi, demo data too', async () => {
    renderAt(<RouteStep tripId={DEMO} />, { path: '/', at: '/', auth })
    await screen.findAllByRole('article', undefined, { timeout: 8000 })
    act(() => applyLang('hi', false))
    expect(await screen.findByText('सबसे अच्छा')).toBeInTheDocument()
    expect(screen.getByText('सफ़र')).toBeInTheDocument()
    expect(screen.getByText(/जयपुर \(सीतापुरा\) पहुँचें/)).toBeInTheDocument()
  })
})

describe('driver message + slot', () => {
  it('message lines, WhatsApp link and place names', () => {
    expect(whatsappLink('+91 98270 00001', 'hi there')).toBe('https://wa.me/919827000001?text=hi%20there')
    expect(whatsappLink('9827000001', 'x')).toBe('https://wa.me/919827000001?text=x')
    expect(whatsappLink(null, 'x')).toBe('https://wa.me/?text=x')
    expect(placeName('Mira-Bhayandar Vasai-Virar', 'hi')).toBe('मीरा-भायंदर वसई-विरार')
    expect(placeName('Ahmedabad', 'hi')).toBe('अहमदाबाद')
    expect(placeName('Mira-Bhayandar Vasai-Virar', 'en')).toBe('Mira-Bhayandar Vasai-Virar')
    const ft = i18n.getFixedT('en', 'routes') as unknown as (k: string, v?: Record<string, unknown>) => string
    const text = driverMessage(
      {
        code: 'TRP-1',
        regNo: 'MP09 HG 4821',
        driverName: 'Ramesh Yadav',
        variantLabel: 'Fastest',
        distanceKm: 100,
        tollsInr: 750,
        tollCount: 1,
        stops: [
          { id: 'o', seq: 0, stop_type: 'origin', name: 'Manesar warehouse', city: '', lat: 0, lng: 0 },
          { id: 'd', seq: 1, stop_type: 'drop', name: 'Jaipur (Sitapura)', city: '', lat: 0, lng: 0 },
        ],
        plan: {
          departure: '2026-11-01T00:30:00.000Z',
          schedule: { halts: [], stopEtas: [{ stopId: 'd', eta: '2026-11-01T03:00:00.000Z' }], warnings: [] },
          driveMin: 150,
          totalMin: 150,
          waitMin: 0,
          checkpointMin: 0,
          tolls: [],
          checkpointCount: 0,
          breakCount: 0,
          overnightCount: 0,
        },
      },
      ft,
      'en',
    )
    expect(text.split('\n')).toEqual([
      'Spareway · TRP-1 · MP09 HG 4821',
      'Namaste Ramesh Yadav,',
      'Leave: 1 Nov, 6:00 am',
      'Route: Fastest · 100 km · 2 h 30 min',
      '',
      'Sun 8:30 am — Reach Jaipur (Sitapura)',
      '',
      'Tolls: 1 · ₹750 (estimated)',
      'Drive safe. Call the owner if anything changes.',
    ])
  })

  it('Route is step 4 on the trip page', () => {
    const step = slotEntries(getModules(), 'trip.steps', { tripId: DEMO }).find((e) => e.id === 'route')
    expect(step).toMatchObject({ order: 4, labelKey: 'routes:step' })
  })
})
