// Extra loads + marketplace in fixture mode: the hook, "Add to trip" (accept_extra_load → plan → activate),
// the screen with one lime button and the collapsed Not suitable list, posting / removing loads.
import type { ReactNode } from 'react'
import { act, fireEvent, renderHook, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fakeAuth, renderAt } from '@/test/renderWithAuth'
import { fixtureStore, resetFixtureStore } from '@/lib/fixtures'
import { applyLang } from '@/lib/i18n'
import { getModules, slotEntries } from '@/app/modules'
import { buildPackItems, pack } from '@/features/load-planner'
import type { Placement } from '@/types/domain'
import { fetchListings, postListing, removeListing } from '../api'
import { addToTrip, bestTripFor, useExtraLoads } from '../hooks'
import { evaluateCandidates, type Candidate } from '../lib/candidates'
import { postLoadSchema } from '../schemas'
import { ExtraLoadsStep } from '../components/ExtraLoadsStep'
import { NH48_LINE } from '../__fixtures__/nh48'

vi.mock('@/lib/realtime', () => ({ useRealtime: () => {} }))

const DEMO = '00000000-0000-4000-8000-000000000031'
const auth = fakeAuth({ status: 'ready' })

beforeAll(() => window.history.replaceState(null, '', '/?fixture=seed'))
afterAll(() => window.history.replaceState(null, '', '/?fixture=off'))
beforeEach(() => {
  resetFixtureStore(new Date('2026-10-31T06:00:00Z'))
  applyLang('en', false)
})

/** The demo trip with the NH48 route chosen (as after the Route step). */
function chooseNh48() {
  const d = fixtureStore()
  const id = crypto.randomUUID()
  d.route_options.push({
    id,
    company_id: d.company.id,
    trip_id: DEMO,
    variant: 'fastest',
    provider: 'ors',
    profile: 'driving-hgv',
    distance_km: 1417,
    duration_min: 1371,
    geometry: { type: 'LineString', coordinates: NH48_LINE } as never,
    toll_count: 0,
    toll_cost_inr: 0,
    fuel_cost_inr: 0,
    driver_cost_inr: 0,
    waiting_cost_inr: 0,
    checkpoint_count: 0,
    total_cost_inr: 0,
    score: 0,
    halts: [],
    warnings: [],
    is_selected: true,
    created_at: new Date().toISOString(),
  })
  d.trips.find((t) => t.id === DEMO)!.selected_route_id = id
}

function candidateFor(code: string): Candidate {
  const d = fixtureStore()
  const trip = d.trips.find((t) => t.id === DEMO)!
  const truck = d.trucks.find((t) => t.id === trip.truck_id)!
  const booked = d.cargo_items.filter((c) => c.trip_id === DEMO).reduce((a, c) => a + c.weight_kg * c.quantity, 0)
  return evaluateCandidates({
    listings: d.freight_listings,
    line: NH48_LINE,
    approximate: false,
    stops: d.trip_stops.filter((s) => s.trip_id === DEMO),
    settings: d.settings,
    truck,
    remainingPayloadKg: truck.payload_kg - booked,
  }).find((c) => c.code === code)!
}

const wrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useExtraLoads (fixture mode)', () => {
  it('checks every open load against the chosen route and the packed truck', async () => {
    chooseNh48()
    const { result } = renderHook(() => useExtraLoads(DEMO), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.status).toBe('ready'), { timeout: 8000 })
    const codes = (list: Candidate[]) => list.map((c) => c.code)
    expect(codes(result.current.recommended).filter((c) => /^LD-104[1-8]$/.test(c)).length).toBeGreaterThanOrEqual(3)
    expect(codes(result.current.recommended)).toContain('LD-1045')
    const reasons = Object.fromEntries(result.current.notSuitable.map((c) => [c.code, c.feasibility.reason]))
    expect(reasons).toMatchObject({ 'LD-1049': 'OFF_CORRIDOR', 'LD-1050': 'WRONG_DIRECTION', 'LD-1051': 'OVER_PAYLOAD', 'LD-1052': 'LOW_MARGIN' })
    expect(result.current.approximate).toBe(false)
    expect(result.current.corridorKm).toBe(40)
    expect(result.current.base?.started).toBe(false)
    // Beawar is after Jaipur but before Ahmedabad: bales for Mumbai would have to go behind the Ahmedabad goods
    expect(reasons['LD-1042']).toBe('ORDER_CONFLICT')
  })

  it('without a chosen route the line is approximate', async () => {
    const { result } = renderHook(() => useExtraLoads(DEMO), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.status).not.toBe('loading'), { timeout: 8000 })
    expect(result.current.approximate).toBe(true)
  })
})

describe('Add to trip (fixture mode)', () => {
  it('LD-1045: Vadodara stop inserted, cargo added, listing taken, activity, new plan active with more space used', async () => {
    const r = await addToTrip(DEMO, candidateFor('LD-1045'))
    const d = fixtureStore()
    const stops = d.trip_stops.filter((s) => s.trip_id === DEMO).sort((a, b) => a.seq - b.seq)
    expect(stops.map((s) => [s.seq, s.name])).toEqual([
      [0, 'Manesar warehouse'],
      [1, 'Jaipur (Sitapura)'],
      [2, 'Ahmedabad (Narol)'],
      [3, 'Vadodara'],
      [4, 'Mumbai (Bhiwandi)'],
    ])
    const added = d.cargo_items.find((c) => c.trip_id === DEMO && c.source === 'extra_load')!
    expect(added).toMatchObject({ label: 'Auto parts (LD-1045)', quantity: 18, pickup_stop_id: stops[3].id, drop_stop_id: stops[4].id })
    expect(d.freight_listings.find((l) => l.code === 'LD-1045')).toMatchObject({ status: 'accepted' })
    expect(d.trip_extra_loads.find((x) => x.trip_id === DEMO)).toMatchObject({ status: 'accepted', net_benefit_inr: candidateFor('LD-1045')?.netBenefitInr ?? expect.any(Number) })
    expect(d.activity_log.find((a) => a.kind === 'extra_load_accepted')).toMatchObject({ meta: { listing_code: 'LD-1045', trip_code: 'TRP-2026-0031', pickup: 'Vadodara', drop: 'Mumbai (Bhiwandi)' } })
    const active = d.load_plans.filter((p) => p.trip_id === DEMO && p.status === 'active')
    expect(active).toHaveLength(1)
    expect((active[0].placements as unknown as Placement[]).length).toBe(104 + 18)
    expect(r.result.unplaced).toEqual([])
    expect(r.after).toBeGreaterThan(r.before)
    expect(Math.round(r.before)).toBe(34)
    expect(d.loading_progress.filter((x) => x.load_plan_id === active[0].id)).toHaveLength(122)
  })

  it('loading started: loaded boxes stay exactly where they are', async () => {
    const d = fixtureStore()
    const trip = d.trips.find((t) => t.id === DEMO)!
    const truck = d.trucks.find((t) => t.id === trip.truck_id)!
    const { container, items } = buildPackItems(d.cargo_items.filter((c) => c.trip_id === DEMO), d.trip_stops.filter((s) => s.trip_id === DEMO), truck)
    const first = pack(container, items)
    const planId = crypto.randomUUID()
    d.load_plans.push({ id: planId, company_id: d.company.id, trip_id: DEMO, version: 1, status: 'active', engine_version: first.engineVersion, input_hash: first.inputHash, placements: first.placements as never, unplaced: [], metrics: first.metrics as never, created_by: null, created_at: new Date().toISOString() })
    const loaded = first.placements.slice(0, 12)
    for (const p of first.placements) d.loading_progress.push({ id: crypto.randomUUID(), company_id: d.company.id, load_plan_id: planId, step_index: p.step, placement_key: p.key, status: loaded.includes(p) ? 'done' : 'pending', note: '', updated_at: '' })
    trip.status = 'loading'

    const r = await addToTrip(DEMO, candidateFor('LD-1045'))
    for (const p of loaded) expect(r.result.placements.find((q) => q.key === p.key)).toMatchObject({ x: p.x, y: p.y, z: p.z, fixed: true })
    expect(r.result.placements.filter((p) => p.fixed)).toHaveLength(12)
  })

  it('taken by someone else meanwhile → LISTING_NOT_OPEN', async () => {
    const c = candidateFor('LD-1045')
    fixtureStore().freight_listings.find((l) => l.code === 'LD-1045')!.status = 'accepted'
    await expect(addToTrip(DEMO, c)).rejects.toMatchObject({ code: 'LISTING_NOT_OPEN' })
  })
})

describe('Extra loads screen (fixture mode)', () => {
  it('tiles, cards sorted by profit with one lime "Add to trip", Not suitable collapsed; Hindi', async () => {
    chooseNh48()
    renderAt(<ExtraLoadsStep tripId={DEMO} />, { path: '/', at: '/', auth })
    await waitFor(() => expect(screen.queryByText('Checking space in the truck…')).not.toBeInTheDocument(), { timeout: 8000 })
    const cards = await screen.findAllByRole('article')
    expect(cards.length).toBeGreaterThanOrEqual(3)
    expect(screen.getByText('Possible extra earning')).toBeInTheDocument()
    const lime = screen.getAllByRole('button', { name: /Add to trip/ }).filter((b) => b.className.includes('bg-accent'))
    expect(lime).toHaveLength(1)
    expect(within(cards[0]).getByRole('button', { name: /Add to trip/ })).toBe(lime[0])
    const toggle = screen.getByRole('button', { name: /Not suitable \(\d\)/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Goes the opposite way')).not.toBeInTheDocument()
    fireEvent.click(toggle)
    expect(screen.getByText('Goes the opposite way')).toBeInTheDocument()
    expect(screen.getByText(/^Too heavy: 16 t > /)).toBeInTheDocument()

    act(() => applyLang('hi', false))
    expect(await screen.findByText('उल्टी दिशा में जाता है')).toBeInTheDocument()
    expect(screen.getAllByText('ट्रिप में जोड़ें').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/मुंबई \(भिवंडी\)/).length).toBeGreaterThan(0)
  })
})

describe('Loads marketplace (fixture mode)', () => {
  it('post a public load (LD-2001, LD-2002), list by status, remove my own', async () => {
    const input = {
      shipper_name: 'Indore Spices',
      shipper_phone: '',
      goods_type: 'Spice sacks',
      pickup: { name: 'Vadodara', lat: 22.3072, lng: 73.1812 },
      drop: { name: 'Mumbai (Bhiwandi)', lat: 19.2813, lng: 73.0483 },
      length_cm: 80,
      width_cm: 50,
      height_cm: 40,
      weight_kg: 40,
      quantity: 20,
      fragile: false,
      offered_rate_inr: 12000,
      ready_from: '2026-11-01T00:00:00Z',
    }
    const a = await postListing(input)
    const b = await postListing(input)
    expect([a.code, b.code]).toEqual(['LD-2001', 'LD-2002'])
    expect(a).toMatchObject({ visibility: 'public', status: 'open', is_sample: false })
    expect((await fetchListings('open')).map((l) => l.code)).toContain('LD-2001')
    expect(await fetchListings('taken')).toEqual([])
    await removeListing(a.id)
    expect((await fetchListings('all')).map((l) => l.code)).not.toContain('LD-2001')
  })

  it('"Find a trip": the demo trip for a load on its way, none for Indore → Bhopal', () => {
    const d = fixtureStore()
    const trips = d.trips
      .filter((t) => t.status === 'planned')
      .map((trip) => ({ trip, stops: d.trip_stops.filter((s) => s.trip_id === trip.id).sort((a, b) => a.seq - b.seq) }))
    const l45 = d.freight_listings.find((l) => l.code === 'LD-1045')!
    const l49 = d.freight_listings.find((l) => l.code === 'LD-1049')!
    expect(bestTripFor(l45, trips)).toBe(DEMO)
    expect(bestTripFor(l49, trips)).toBeNull()
  })

  it('post form rules', () => {
    const ok = { shipper_name: 'A', shipper_phone: '', goods_type: 'B', from: 'vadodara', to: 'mumbai-bhiwandi', length_cm: '80', width_cm: '50', height_cm: '40', weight_kg: '40', quantity: '2', fragile: false, offered_rate_inr: '5000', ready_from: '2026-11-01' }
    expect(postLoadSchema.safeParse(ok).success).toBe(true)
    const same = postLoadSchema.safeParse({ ...ok, to: 'vadodara' })
    expect(same.success).toBe(false)
    expect(same.error?.issues[0]).toMatchObject({ path: ['to'], message: 'extra-loads:form.err.same' })
    expect(postLoadSchema.safeParse({ ...ok, length_cm: '2' }).success).toBe(false)
    expect(postLoadSchema.safeParse({ ...ok, offered_rate_inr: '0' }).success).toBe(false)
  })

  it('slots and nav are registered', () => {
    const m = getModules()
    expect(slotEntries(m, 'trip.steps', { tripId: DEMO }).find((e) => e.id === 'extra-loads')).toMatchObject({ order: 5 })
    expect(slotEntries(m, 'home.actions', {}).map((e) => e.id)).toContain('find-extra-loads')
    expect(slotEntries(m, 'home.widgets', {}).map((e) => e.id)).toContain('extra-earnings')
    expect(m.find((x) => x.id === 'extra-loads')?.nav).toMatchObject({ path: '/loads', phone: 'more' })
  })
})
