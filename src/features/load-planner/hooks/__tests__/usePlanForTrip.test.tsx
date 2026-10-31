import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { buildSeed } from '@/lib/fixtures'
import { queryKeys } from '@/lib/queryKeys'
import type { Tables } from '@/types/database'
import { buildPackItems, computeInputHash, pack } from '../../engine'
import { setPacker, type Packer } from '../../worker/client'
import { tripHasActivePlan } from '../../lib/stepState'

const seed = buildSeed(new Date('2026-10-31T06:00:00Z'))
const trip = seed.trips.find((t) => t.code === 'TRP-2026-0031')!
const truck = seed.trucks.find((t) => t.id === trip.truck_id)!
const stops = seed.trip_stops.filter((s) => s.trip_id === trip.id)
const cargo = seed.cargo_items.filter((c) => c.trip_id === trip.id)
const { container, items } = buildPackItems(cargo, stops, truck)
const hash = computeInputHash(container, items, { supportRatio: 1 })

const api = vi.hoisted(() => ({
  fetchTripBasics: vi.fn(),
  fetchStops: vi.fn(),
  fetchCargo: vi.fn(),
  fetchPlans: vi.fn(),
  fetchProgress: vi.fn(),
  savePlan: vi.fn(),
  activatePlan: vi.fn(),
}))
vi.mock('../../api', () => api)
vi.mock('@/lib/realtime', () => ({ useRealtime: () => {} }))

function planRow(over: Partial<Tables<'load_plans'>> = {}): Tables<'load_plans'> {
  const r = pack(container, items, { supportRatio: 1 })
  return {
    id: 'plan-1',
    company_id: 'c',
    trip_id: trip.id,
    version: 1,
    status: 'draft',
    engine_version: r.engineVersion,
    input_hash: r.inputHash,
    placements: r.placements as never,
    unplaced: [],
    metrics: r.metrics as never,
    created_by: null,
    created_at: '2026-10-31T06:00:00Z',
    ...over,
  }
}

let fakePack: ReturnType<typeof vi.fn>
function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  return { qc, wrapper }
}

beforeEach(() => {
  vi.clearAllMocks()
  api.fetchTripBasics.mockResolvedValue({ trip, truck, supportRatio: 1 })
  api.fetchStops.mockResolvedValue(stops)
  api.fetchCargo.mockResolvedValue(cargo)
  api.fetchPlans.mockResolvedValue([])
  api.fetchProgress.mockResolvedValue([])
  fakePack = vi.fn(async (c, i, o) => pack(c, i, o))
  setPacker({ pack: fakePack, fitAdditional: vi.fn() } as unknown as Packer)
})
afterAll(() => setPacker(null))

describe('usePlanForTrip', () => {
  it('packs in the worker when nothing is saved, then "Use this plan" saves and activates', async () => {
    const { usePlanForTrip } = await import('../usePlanForTrip')
    const saved = planRow({ id: 'new-plan' })
    api.savePlan.mockResolvedValue(saved)
    api.activatePlan.mockResolvedValue(undefined)
    const { qc, wrapper } = setup()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => usePlanForTrip(trip.id), { wrapper })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(fakePack).toHaveBeenCalledTimes(1)
    expect(result.current.result?.placements).toHaveLength(104)
    expect(result.current.inputHash).toBe(hash)
    expect(result.current.isActive).toBe(false)
    expect(result.current.canActivate).toBe(true)

    await act(() => result.current.activate())
    expect(api.savePlan).toHaveBeenCalledWith(trip, expect.objectContaining({ inputHash: hash }))
    expect(api.activatePlan).toHaveBeenCalledWith('new-plan')
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.tripPlans(trip.id) })
    expect(tripHasActivePlan(trip.id)).toBe(true)
  })

  it('reuses a saved plan with the same input hash (no packing)', async () => {
    const { usePlanForTrip } = await import('../usePlanForTrip')
    api.fetchPlans.mockResolvedValue([planRow()])
    api.activatePlan.mockResolvedValue(undefined)
    const { wrapper } = setup()
    const { result } = renderHook(() => usePlanForTrip(trip.id), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(fakePack).not.toHaveBeenCalled()
    expect(result.current.savedPlan?.id).toBe('plan-1')
    await act(() => result.current.activate())
    expect(api.savePlan).not.toHaveBeenCalled()
    expect(api.activatePlan).toHaveBeenCalledWith('plan-1')
  })

  it('shows the active plan, its live progress, and notices when the cargo changed', async () => {
    const { usePlanForTrip } = await import('../usePlanForTrip')
    api.fetchPlans.mockResolvedValue([planRow({ status: 'active' })])
    api.fetchProgress.mockResolvedValue([{ step_index: 1, placement_key: 'x', status: 'done' }])
    const { wrapper } = setup()
    const { result } = renderHook(() => usePlanForTrip(trip.id), { wrapper })
    await waitFor(() => expect(result.current.progress).toHaveLength(1))
    expect(result.current.isActive).toBe(true)
    expect(api.fetchProgress).toHaveBeenCalledWith('plan-1')

    api.fetchPlans.mockResolvedValue([planRow({ status: 'active', input_hash: 'older' })])
    const second = renderHook(() => usePlanForTrip(trip.id), { wrapper: setup().wrapper })
    await waitFor(() => expect(second.result.current.status).toBe('ready'))
    expect(second.result.current.isActive).toBe(false)
    expect(second.result.current.isOutdated).toBe(true)
  })

  it('no cargo → "Add cargo first" state, nothing packed', async () => {
    const { usePlanForTrip } = await import('../usePlanForTrip')
    api.fetchCargo.mockResolvedValue([])
    const { wrapper } = setup()
    const { result } = renderHook(() => usePlanForTrip(trip.id), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('noCargo'))
    expect(fakePack).not.toHaveBeenCalled()
  })

  it('a trip that already left cannot get a new plan', async () => {
    const { usePlanForTrip } = await import('../usePlanForTrip')
    api.fetchTripBasics.mockResolvedValue({ trip: { ...trip, status: 'in_transit' }, truck, supportRatio: 1 })
    const { wrapper } = setup()
    const { result } = renderHook(() => usePlanForTrip(trip.id), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.canActivate).toBe(false)
  })

  it('error state when the trip cannot be read', async () => {
    const { usePlanForTrip } = await import('../usePlanForTrip')
    api.fetchTripBasics.mockRejectedValue(new Error('TRIP_NOT_FOUND'))
    const { wrapper } = setup()
    const { result } = renderHook(() => usePlanForTrip(trip.id), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('error'))
  })

  it('uses the company support ratio', async () => {
    const { usePlanForTrip } = await import('../usePlanForTrip')
    api.fetchTripBasics.mockResolvedValue({ trip, truck, supportRatio: 0.8 })
    const { wrapper } = setup()
    const { result } = renderHook(() => usePlanForTrip(trip.id), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(fakePack).toHaveBeenCalledWith(container, items, { supportRatio: 0.8 })
    expect(result.current.inputHash).not.toBe(hash)
  })
})
