import { challanRisks, overloadFineInr } from './lib/risks'
import { historyCsv, historyTotals, monthOf, pastTrips, type HistoryRow } from '@/features/history'
import { buildSeed, fixtureTripFinancials } from '@/lib/fixtures'

describe('challan risks', () => {
  it('overload fine is ₹20,000 + ₹2,000 per extra tonne (part tonne counts)', () => {
    expect(overloadFineInr(15000, 15000)).toBe(0)
    expect(overloadFineInr(15001, 15000)).toBe(22000)
    expect(overloadFineInr(17500, 15000)).toBe(26000)
  })
  it('flags overload, near the limit, no-entry and late', () => {
    expect(challanRisks({ cargoKg: 16000, payloadKg: 15000, warnings: [] })[0]).toMatchObject({ code: 'OVERLOAD', level: 'critical', values: { extraKg: 1000, fine: 22000 } })
    expect(challanRisks({ cargoKg: 14500, payloadKg: 15000, warnings: [] })[0]).toMatchObject({ code: 'NEAR_LIMIT', values: { pct: 97 } })
    const r = challanRisks({ cargoKg: 1000, payloadKg: 15000, warnings: [{ code: 'NO_ENTRY', city: 'Jaipur', waitMin: 95 }, { code: 'LATE', stop: 'Pune' }] })
    expect(r.map((x) => x.code)).toEqual(['NO_ENTRY', 'LATE'])
    expect(challanRisks({ cargoKg: 1000, payloadKg: 15000, warnings: [] })).toEqual([])
  })
})

describe('trip costs in earnings and history', () => {
  it('the sample challan comes off the finished trip net earnings', () => {
    const d = buildSeed(new Date('2026-10-20T10:00:00Z'))
    const done = fixtureTripFinancials(d).find((f) => f.status === 'completed')!
    expect(done.misc_cost_inr).toBe(2000)
    expect(done.challan_cost_inr).toBe(2000)
    expect(done.net_earnings_inr).toBe(done.base_freight_inr! - 2000)
  })

  const row = (o: Partial<HistoryRow>): HistoryRow => ({
    tripId: 'a', code: 'TRP-1', status: 'completed', departure: '2026-10-01T00:30:00Z', completedAt: '2026-10-31T19:00:00Z',
    from: 'Indore', to: 'Pune, MH', regNo: 'MP09', driver: 'Ramesh', stops: 2, cargoKg: 9000, km: 600, freightInr: 30000,
    extraInr: 0, routeCostInr: 21000, extraCostInr: 0, miscInr: 2500, challanInr: 2000, netInr: 6500, ...o,
  })
  it('history keeps finished / cancelled trips, months in India time, totals over completed only', () => {
    const rows = [row({}), row({ tripId: 'b', status: 'cancelled', netInr: 0 }), row({ tripId: 'c', status: 'in_transit' })]
    expect(pastTrips(rows).map((r) => r.tripId)).toEqual(['a', 'b'])
    expect(monthOf(rows[0])).toBe('2026-11') // 31 Oct 19:00 UTC = 1 Nov IST
    expect(historyTotals(pastTrips(rows))).toEqual({ trips: 1, km: 600, netInr: 6500, challanInr: 2000, miscInr: 2500 })
  })
  it('CSV quotes commas and splits challans from other costs', () => {
    const csv = historyCsv([row({})]).split('\r\n')
    expect(csv[0]).toContain('Challans ₹')
    expect(csv[1]).toContain('"Pune, MH"')
    expect(csv[1].endsWith(',2000,500,6500')).toBe(true)
  })
})
