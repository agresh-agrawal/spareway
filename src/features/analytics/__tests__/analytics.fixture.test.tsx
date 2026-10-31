// Earnings step, /earnings page and Home widget in fixture mode (English + Hindi).
import type { ReactNode } from 'react'
import { act, renderHook, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fakeAuth, renderAt } from '@/test/renderWithAuth'
import { fixtureStore, resetFixtureStore } from '@/lib/fixtures'
import { applyLang } from '@/lib/i18n'
import { getModules, slotEntries } from '@/app/modules'
import { fetchTripsDone } from '../api'
import { usePeriod, useTripEarnings } from '../hooks'
import { EarningsStep } from '../components/EarningsStep'
import { ThisWeekWidget } from '../components/ThisWeekWidget'
import EarningsPage from '../pages/EarningsPage'

vi.mock('@/lib/realtime', () => ({ useRealtime: () => {} }))
// recharts needs layout (not in jsdom); the chart is shared Phase 0 code
vi.mock('@/components/common/SimpleBarChart', () => ({ SimpleBarChart: ({ ariaLabel }: { ariaLabel: string }) => <div role="img" aria-label={ariaLabel} /> }))

const DEMO = '00000000-0000-4000-8000-000000000031'
const auth = fakeAuth({ status: 'ready' })

beforeAll(() => window.history.replaceState(null, '', '/?fixture=seed'))
afterAll(() => window.history.replaceState(null, '', '/?fixture=off'))
beforeEach(() => {
  resetFixtureStore(new Date('2026-10-31T06:00:00Z'))
  applyLang('en', false)
})

const wrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

/** Engineering Reference 7.8: route cost 40,000; LD-1045 accepted (offer 14,000, cost 3,550, 18 × 80×60×60 cm). */
function demoWithRouteAndExtra() {
  const d = fixtureStore()
  const routeId = crypto.randomUUID()
  d.route_options.push({
    id: routeId, company_id: d.company.id, trip_id: DEMO, variant: 'fastest', provider: 'ors', profile: 'driving-hgv',
    distance_km: 1417, duration_min: 1371, geometry: { type: 'LineString', coordinates: [] } as never, toll_count: 0, toll_cost_inr: 0,
    fuel_cost_inr: 0, driver_cost_inr: 0, waiting_cost_inr: 0, checkpoint_count: 0, total_cost_inr: 40000, score: 0, halts: [], warnings: [],
    is_selected: true, created_at: new Date().toISOString(),
  })
  d.trips.find((t) => t.id === DEMO)!.selected_route_id = routeId
  const listing = d.freight_listings.find((l) => l.code === 'LD-1045')!
  const extraId = crypto.randomUUID()
  d.trip_extra_loads.push({
    id: extraId, company_id: d.company.id, trip_id: DEMO, listing_id: listing.id, status: 'accepted', pickup_stop_id: null, drop_stop_id: null,
    detour_km: 18, detour_min: 54, cost_breakdown: {}, incremental_cost_inr: 3550, net_benefit_inr: 10450, min_viable_rate_inr: 4050, feasibility: {},
    created_at: new Date().toISOString(),
  })
  const mumbai = d.trip_stops.find((s) => s.trip_id === DEMO && s.seq === 3)!
  d.cargo_items.push({
    ...d.cargo_items.find((c) => c.trip_id === DEMO)!, id: crypto.randomUUID(), label: 'Auto parts (LD-1045)', length_cm: 80, width_cm: 60, height_cm: 60,
    weight_kg: 45, quantity: 18, drop_stop_id: mumbai.id, source: 'extra_load', extra_load_id: extraId,
  })
}

describe('useTripEarnings (fixture mode)', () => {
  it('Engineering Reference 7.8 numbers on the demo trip + before → after', async () => {
    demoWithRouteAndExtra()
    const { result } = renderHook(() => useTripEarnings(DEMO), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.view).not.toBeNull(), { timeout: 5000 })
    const v = result.current.view!
    expect(v.money).toEqual({ netInr: 32450, beforeInr: 22000, gainInr: 10450, hasRoute: true })
    expect(Math.round(v.space.beforePct)).toBe(34)
    expect(v.space.afterPct).toBeGreaterThan(v.space.beforePct)
    expect(v.floorSavedCm).toBeGreaterThan(0)
    expect(v.perTonneKm.before).toBe(10.7)
    expect(v.perTonneKm.after).toBeLessThan(v.perTonneKm.before!)
  })

  it('no route chosen → costs not known', async () => {
    const { result } = renderHook(() => useTripEarnings(DEMO), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.view).not.toBeNull(), { timeout: 5000 })
    expect(result.current.view!).toMatchObject({ hasRoute: false, hasExtra: false, money: { netInr: 62000 }, perTonneKm: { before: null, after: null } })
  })

  it('period totals for 7 and 30 days from fleet_daily_stats', async () => {
    const w = renderHook(() => usePeriod(7), { wrapper: wrapper() })
    await waitFor(() => expect(w.result.current.totals).not.toBeNull())
    expect(w.result.current.totals!.days).toHaveLength(7)
    expect(w.result.current.totals!.sample).toBe(true)
    const m = renderHook(() => usePeriod(30), { wrapper: wrapper() })
    await waitFor(() => expect(m.result.current.totals).not.toBeNull())
    expect(m.result.current.totals!.days).toHaveLength(30)
    expect(m.result.current.totals!.earnedInr).toBeGreaterThan(w.result.current.totals!.earnedInr)
  })

  it('trips done in the last 7 days', async () => {
    expect(await fetchTripsDone(7, new Date('2026-10-31T06:00:00Z'))).toBe(1)
  })
})

describe('screens (fixture mode)', () => {
  it('Earnings step: hero, gain, tiles, add-up list, one lime Share; Hindi', async () => {
    demoWithRouteAndExtra()
    renderAt(<EarningsStep tripId={DEMO} />, { path: '/', at: '/', auth })
    expect(await screen.findByText('You earn ₹32,450', undefined, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByText('+₹10,450 from extra loads')).toBeInTheDocument()
    expect(screen.getByText(/^34% → \d+%$/)).toBeInTheDocument()
    expect(screen.getByText('₹10.70 → ₹8.91')).toBeInTheDocument()
    const list = screen.getByText('How it adds up').closest('div')!.parentElement!
    expect(within(list).getByText('₹62,000')).toBeInTheDocument()
    expect(within(list).getByText('₹40,000')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Share on WhatsApp/ }).getAttribute('href')).toContain(encodeURIComponent('You earn ₹32,450'))
    act(() => applyLang('hi', false))
    expect(await screen.findByText('आपकी कमाई ₹32,450', { selector: 'h2' })).toBeInTheDocument()
    expect(screen.getByText('अतिरिक्त लोड से +₹10,450')).toBeInTheDocument()
  })

  it('Earnings step without a route: "Choose a route to see costs"', async () => {
    renderAt(<EarningsStep tripId={DEMO} />, { path: '/', at: '/', auth })
    expect(await screen.findByText('Choose a route to see costs', undefined, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open Route/ })).toHaveAttribute('href', `/trips/${DEMO}?step=route`)
  })

  it('/earnings: 7 / 30 days, three big numbers, two charts, top trips', async () => {
    renderAt(<EarningsPage />, { path: '/', at: '/', auth })
    expect(await screen.findByText('Earned', undefined, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByText('From extra loads')).toBeInTheDocument()
    expect(screen.getByText('Space used')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Money earned per day' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Space used per day' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '7 days' })).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByText('TRP-2026-0031')).toBeInTheDocument()
    expect(screen.getAllByText('Costs not known — no route chosen').length).toBeGreaterThan(0)
  })

  it('Home widget "Money this week"', async () => {
    renderAt(<ThisWeekWidget />, { path: '/', at: '/', auth })
    expect(await screen.findByText('Money this week', undefined, { timeout: 5000 })).toBeInTheDocument()
    expect(await screen.findByText(/1 trip done/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /See earnings/ })).toHaveAttribute('href', '/earnings')
  })

  it('slot, widget and nav are registered', () => {
    const m = getModules()
    expect(slotEntries(m, 'trip.steps', { tripId: DEMO }).find((e) => e.id === 'earnings')).toMatchObject({ order: 6 })
    expect(slotEntries(m, 'home.widgets', {}).map((e) => e.id)).toContain('this-week-money')
    expect(m.find((x) => x.id === 'analytics')?.nav).toMatchObject({ path: '/earnings', phone: 'more' })
  })
})
