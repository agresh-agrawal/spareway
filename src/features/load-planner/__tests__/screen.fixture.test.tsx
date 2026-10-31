// The Load plan screen and slot components render from fixture data (no database, no WebGL → drawings).
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { fakeAuth, renderAt } from '@/test/renderWithAuth'
import { fixtureStore, resetFixtureStore } from '@/lib/fixtures'
import { applyLang } from '@/lib/i18n'
import { getModules, slotEntries } from '@/app/modules'
import { setPacker } from '../worker/client'
import LoadPlanPage from '../pages/LoadPlanPage'
import { PlanLoadAction, TruckLoadLayout } from '../components/slots'

vi.mock('@/lib/realtime', () => ({ useRealtime: () => {} }))

const DEMO = '00000000-0000-4000-8000-000000000031'
const auth = fakeAuth({ status: 'ready' })

beforeAll(() => window.history.replaceState(null, '', '/?fixture=seed'))
afterAll(() => window.history.replaceState(null, '', '/?fixture=off'))
beforeEach(() => {
  resetFixtureStore(new Date('2026-10-31T06:00:00Z'))
  setPacker(null)
  applyLang('en', false)
})

describe('load plan screen (fixture mode)', () => {
  it('packs the demo trip, explains it and activates it', async () => {
    renderAt(<LoadPlanPage />, { path: '/trips/:tripId/plan', at: `/trips/${DEMO}/plan`, auth })
    expect(await screen.findByRole('button', { name: /Use this plan/ }, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByText('Load plan · TRP-2026-0031')).toBeInTheDocument()
    expect(screen.getByText('34%')).toBeInTheDocument()
    expect(screen.getByText('Balance OK')).toBeInTheDocument()
    expect(screen.getByText('Everything fits in the truck')).toBeInTheDocument()
    expect(screen.getByText('Steps 1–32 · 1,122 kg')).toBeInTheDocument()
    // no WebGL in jsdom → drawings, no 3D button
    expect(screen.queryByRole('button', { name: '3D' })).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: /From top/ })).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: /Show in truck/ })[0])
    expect(screen.getByText(/Step 65 · Split AC indoor unit 1.5T/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Use this plan/ }))
    expect(await screen.findByText('In use · v1')).toBeInTheDocument()
    const d = fixtureStore()
    expect(d.load_plans.filter((p) => p.trip_id === DEMO).map((p) => p.status)).toEqual(['active'])
    expect(d.loading_progress).toHaveLength(104)
  })

  it('shows everything in Hindi, demo data too', async () => {
    renderAt(<LoadPlanPage />, { path: '/trips/:tripId/plan', at: `/trips/${DEMO}/plan`, auth })
    await screen.findByRole('button', { name: /Use this plan/ }, { timeout: 5000 })
    act(() => applyLang('hi', false))
    expect(await screen.findByRole('button', { name: /यह प्लान चालू करें/ })).toBeInTheDocument()
    expect(screen.getByText('भरी जगह')).toBeInTheDocument()
    expect(screen.getByText('संतुलन ठीक')).toBeInTheDocument()
    expect(screen.getByText('मुंबई (भिवंडी)')).toBeInTheDocument()
    expect(screen.getByText('स्प्लिट AC इनडोर यूनिट 1.5 टन')).toBeInTheDocument()
  })

  it('"Add cargo first" when the trip has no cargo', async () => {
    fixtureStore().cargo_items = fixtureStore().cargo_items.filter((c) => c.trip_id !== DEMO)
    renderAt(<LoadPlanPage />, { path: '/trips/:tripId/plan', at: `/trips/${DEMO}/plan`, auth })
    expect(await screen.findByText('Add cargo first')).toBeInTheDocument()
  })

  it('a trip on the road shows its plan but cannot change it', async () => {
    const live = fixtureStore().trips.find((t) => t.code === 'TRP-2026-0029')!
    renderAt(<LoadPlanPage />, { path: '/trips/:tripId/plan', at: `/trips/${live.id}/plan`, auth })
    expect(await screen.findByText(/already left/, undefined, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Use this plan/ })).not.toBeInTheDocument()
  })
})

describe('slots', () => {
  it('are registered on trip.steps (2), home.actions and truck.tabs', () => {
    const m = getModules()
    const step = slotEntries(m, 'trip.steps', { tripId: DEMO }).find((e) => e.id === 'load-plan')
    expect(step).toMatchObject({ order: 2, labelKey: 'common:words.loadPlan' })
    expect(step?.done?.({ tripId: DEMO })).toBe(false)
    expect(slotEntries(m, 'home.actions', {}).map((e) => e.id)).toContain('plan-load')
    expect(slotEntries(m, 'truck.tabs', { truckId: 'x' }).map((e) => e.id)).toContain('load-layout')
  })

  it('"Plan load" opens the next trip without a plan', async () => {
    renderAt(<PlanLoadAction />, { path: '/', at: '/', auth })
    const link = await screen.findByRole('link', { name: /Plan load/ })
    expect(link).toHaveAttribute('href', `/trips/${DEMO}/plan`)
  })

  it('truck tab: in-transit trip without a saved layout, and a planned trip without a plan', async () => {
    const d = fixtureStore()
    const gj = d.trucks.find((t) => t.reg_no === 'GJ01 KT 2208')!
    const first = renderAt(<TruckLoadLayout truckId={gj.id} />, { path: '/', at: '/', auth })
    expect(await screen.findByText('This plan was saved without a layout')).toBeInTheDocument()
    expect(screen.getByText('Trip TRP-2026-0029')).toBeInTheDocument()
    first.unmount()

    const mp = d.trucks.find((t) => t.reg_no === 'MP09 HG 4821')!
    renderAt(<TruckLoadLayout truckId={mp.id} />, { path: '/', at: '/', auth })
    await waitFor(() => expect(screen.getByText('No load plan yet for TRP-2026-0031')).toBeInTheDocument())
    expect(screen.getByRole('link', { name: /Open load plan/ })).toHaveAttribute('href', `/trips/${DEMO}/plan`)
  })
})
