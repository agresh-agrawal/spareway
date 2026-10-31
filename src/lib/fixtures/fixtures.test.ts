import {
  fixtureDashboardStats,
  fixtureTripFinancials,
  fixtureTripOverview,
  isFixtureMode,
  resetFixtureStore,
} from './index'
import { slotEntries } from '@/app/modules'
import type { SlotName } from '@/types/domain'

describe('fixture data = Engineering Reference 7 / SQL seed', () => {
  const d = resetFixtureStore(new Date('2026-10-31T06:30:00Z'))

  it('dashboard numbers (7.5)', () => {
    expect(fixtureDashboardStats(d)).toEqual({
      active_trucks: 3,
      total_trucks: 6,
      drivers_on_duty: 4,
      total_drivers: 6,
      live_trips: 1,
      avg_utilisation_pct: 71.2,
      on_time_pct: 100,
    })
  })

  it('demo trip TRP-2026-0031: 104 units, 2,638 kg, ≈ 19.8 m³, 3 drops (7.3)', () => {
    const demo = fixtureTripOverview(d).find((t) => t.code === 'TRP-2026-0031')!
    expect(demo.cargo_units).toBe(104)
    expect(demo.cargo_weight_kg).toBe(2638)
    expect(Math.round(demo.cargo_volume_m3! * 10) / 10).toBe(19.8)
    expect(demo.stop_count).toBe(3)
    expect(demo.origin_name).toBe('Manesar warehouse')
    expect(demo.final_stop_name).toBe('Mumbai (Bhiwandi)')
    expect(demo.reg_no).toBe('MP09 HG 4821')
  })

  it('the rest of the sample company', () => {
    expect(d.trucks).toHaveLength(6)
    expect(d.trips.map((t) => t.status).sort()).toEqual(['completed', 'in_transit', 'planned'])
    expect(d.freight_listings.map((l) => l.code)).toEqual(Array.from({ length: 12 }, (_, i) => `LD-${1041 + i}`))
    expect(d.alerts).toHaveLength(0) // only loader reports exist; none in the sample
    expect(d.activity_log).toHaveLength(4)
    expect(d.fleet_daily_stats).toHaveLength(30)
    expect(d.fleet_daily_stats.filter((s) => s.extra_load_revenue_inr > 0)).toHaveLength(6)
  })

  it('demo departure is 06:00 IST tomorrow', () => {
    const demo = d.trips.find((t) => t.code === 'TRP-2026-0031')!
    expect(demo.planned_departure).toBe('2026-11-01T00:30:00.000Z')
  })

  it('earnings view: base freight with no route chosen', () => {
    expect(fixtureTripFinancials(d).find((t) => t.code === 'TRP-2026-0031')!.net_earnings_inr).toBe(62000)
  })

  it('is on with ?fixture=seed in dev and off again with ?fixture=off', () => {
    window.history.replaceState(null, '', '/?fixture=seed')
    expect(isFixtureMode()).toBe(true)
    window.history.replaceState(null, '', '/trips')
    expect(isFixtureMode()).toBe(true)
    window.history.replaceState(null, '', '/?fixture=off')
    expect(isFixtureMode()).toBe(false)
  })
})

describe('all 8 slots exist and are empty until features fill them', () => {
  const names: SlotName[] = [
    'home.actions',
    'home.widgets',
    'settings.sections',
    'truck.tabs',
    'trip.steps',
    'trip.actions',
    'cargo.addMethods',
    'loader.actions',
  ]
  it.each(names)('%s renders nothing with no modules', (name) => {
    expect(slotEntries([], name, {} as never)).toEqual([])
  })
})
