// The fixture-mode api copies what the SQL does (activate_load_plan).
import { resetFixtureStore, fixtureStore } from '@/lib/fixtures'
import { activatePlan, fetchCargo, fetchPlannableTrips, fetchPlans, fetchStops, fetchTripBasics, fetchTruckLayout, savePlan } from '../api'
import { buildPackItems, pack } from '../engine'
import { getPacker, setPacker } from '../worker/client'

beforeAll(() => window.history.replaceState(null, '', '/?fixture=seed'))
afterAll(() => window.history.replaceState(null, '', '/?fixture=off'))
beforeEach(() => resetFixtureStore(new Date('2026-10-31T06:00:00Z')))

const demoId = () => fixtureStore().trips.find((t) => t.code === 'TRP-2026-0031')!.id

describe('load-planner api (fixture mode)', () => {
  it('reads the demo trip', async () => {
    const id = demoId()
    const basics = await fetchTripBasics(id)
    expect(basics.truck.reg_no).toBe('MP09 HG 4821')
    expect(basics.supportRatio).toBe(1)
    expect((await fetchStops(id)).map((s) => s.seq)).toEqual([0, 1, 2, 3])
    expect((await fetchCargo(id)).reduce((a, c) => a + c.quantity, 0)).toBe(104)
    await expect(fetchTripBasics('nope')).rejects.toMatchObject({ code: 'TRIP_NOT_FOUND' })
  })

  it('save + activate: next version, steps for every box, activity with meta, older plan superseded', async () => {
    const id = demoId()
    const { trip, truck } = await fetchTripBasics(id)
    const { container, items } = buildPackItems(await fetchCargo(id), await fetchStops(id), truck)
    const result = pack(container, items)

    const v1 = await savePlan(trip, result)
    expect(v1).toMatchObject({ version: 1, status: 'draft', input_hash: result.inputHash })
    await activatePlan(v1.id)
    const d = fixtureStore()
    expect(d.load_plans.find((p) => p.id === v1.id)?.status).toBe('active')
    const steps = d.loading_progress.filter((r) => r.load_plan_id === v1.id)
    expect(steps).toHaveLength(104)
    expect(steps.every((r) => r.status === 'pending' && r.step_index >= 1)).toBe(true)
    const act = d.activity_log.at(-1)!
    expect(act).toMatchObject({ kind: 'plan_activated', entity_ref: 'TRP-2026-0031', meta: { version: 1, volumeUsedPct: '34.4' } })
    expect(d.alerts.filter((a) => a.kind === 'plan_unplaced')).toHaveLength(0)

    const v2 = await savePlan(trip, result)
    await activatePlan(v2.id)
    expect(v2.version).toBe(2)
    const plans = await fetchPlans(id)
    expect(plans.map((p) => [p.version, p.status])).toEqual([
      [2, 'active'],
      [1, 'superseded'],
    ])
    expect((await fetchPlannableTrips()).find((x) => x.trip.id === id)?.activePlanId).toBe(v2.id)
    expect((await fetchTruckLayout(truck.id))?.plan?.id).toBe(v2.id)
  })

  it('a plan with items that did not fit lists them on the plan and writes no problem', async () => {
    const id = demoId()
    const { trip } = await fetchTripBasics(id)
    const result = pack({ lengthCm: 100, widthCm: 100, heightCm: 100, payloadKg: 50 }, [
      { key: 'a#1', cargoItemId: 'a', label: 'a', l: 50, w: 50, h: 50, weightKg: 40, unloadOrder: 1, fragile: false, uprightOnly: false, stackable: true },
      { key: 'a#2', cargoItemId: 'a', label: 'a', l: 50, w: 50, h: 50, weightKg: 40, unloadOrder: 1, fragile: false, uprightOnly: false, stackable: true },
    ])
    const before = fixtureStore().alerts.length
    const saved = await savePlan(trip, result)
    expect((saved.unplaced as unknown[]).length).toBe(1)
    expect(fixtureStore().alerts).toHaveLength(before)
  })

  it('the packer runs on the main thread when Workers are missing', async () => {
    setPacker(null)
    const { container, items } = buildPackItems(
      fixtureStore().cargo_items.filter((c) => c.trip_id === demoId()),
      fixtureStore().trip_stops,
      fixtureStore().trucks[0],
    )
    const r = await getPacker().pack(container, items)
    expect(r).toEqual(pack(container, items))
  })
})
