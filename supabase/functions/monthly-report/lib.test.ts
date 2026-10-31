import { buildReport, monthRange, parseSender, previousMonth, renderEmail, tipText, type ReportTrip } from './lib'

const trip = (o: Partial<ReportTrip> = {}): ReportTrip => ({
  code: 'TRP-2026-0030',
  status: 'completed',
  completedAt: '2026-10-10T10:00:00Z',
  km: 600,
  freightInr: 30000,
  extraInr: 0,
  routeCostInr: 22000,
  extraCostInr: 0,
  miscInr: 0,
  challanInr: 0,
  netInr: 8000,
  spacePct: 85,
  ...o,
})

describe('monthly report', () => {
  it('previous month is worked out in India time', () => {
    // 1 Nov 00:10 IST = 31 Oct 18:40 UTC → October
    expect(previousMonth(new Date('2026-10-31T18:40:00Z')).month).toBe('2026-10')
    expect(previousMonth(new Date('2026-01-01T03:30:00Z')).month).toBe('2025-12')
    const r = monthRange('2026-10')
    expect(r.startIso).toBe('2026-09-30T18:30:00.000Z')
    expect(r.endIso).toBe('2026-10-31T18:30:00.000Z')
  })

  it('adds up completed trips and gives tips from the numbers', () => {
    const r = buildReport(
      '2026-10',
      [
        trip(),
        trip({ code: 'B', netInr: -1500, freightInr: 20000, routeCostInr: 19500, miscInr: 2000, challanInr: 2000, spacePct: 40 }),
        trip({ code: 'C', status: 'cancelled', netInr: 0 }),
      ],
      5000,
    )
    expect(r.trips).toBe(2)
    expect(r.km).toBe(1200)
    expect(r.revenueInr).toBe(50000)
    expect(r.costInr).toBe(43500)
    expect(r.netInr).toBe(6500)
    expect(r.challanInr).toBe(2000)
    expect(r.avgSpacePct).toBe(63)
    expect(r.tips.map((t) => t.code)).toEqual(['CHALLANS', 'LOSS', 'SPACE'])
  })

  it('says good month when nothing to fix, and no trips when empty', () => {
    expect(buildReport('2026-10', [trip()], null).tips).toEqual([{ code: 'GOOD' }])
    expect(buildReport('2026-10', [], null).tips).toEqual([{ code: 'NO_TRIPS' }])
  })

  it('low-margin tip quotes cost per km + 10 %', () => {
    const r = buildReport('2026-10', [trip({ netInr: 500, routeCostInr: 29500 })], null)
    expect(r.tips).toContainEqual({ code: 'LOW_MARGIN', count: 1, minPerKm: 55 })
  })

  it('renders the email in English and Hindi without raw HTML from names', () => {
    const r = buildReport('2026-10', [trip()], null)
    const en = renderEmail(r, 'en', 'Agresh <b>', 'Agrawal Transport', 'https://spareway.vercel.app')
    expect(en.subject).toContain('₹8,000')
    expect(en.html).toContain('Agresh &lt;b&gt;')
    expect(en.html).toContain('https://spareway.vercel.app/history')
    const hi = renderEmail(r, 'hi', '', 'Agrawal Transport', 'https://spareway.vercel.app')
    expect(hi.subject).toContain('रिपोर्ट')
    expect(tipText({ code: 'SPACE', pct: 50 }, 'hi')).toContain('50%')
  })

  it('reads the sender', () => {
    expect(parseSender('Spareway <hello@agreshagrawal.com>')).toEqual({ email: 'hello@agreshagrawal.com', name: 'Spareway' })
    expect(parseSender('hello@agreshagrawal.com')).toEqual({ email: 'hello@agreshagrawal.com', name: 'Spareway' })
    expect(parseSender('nope')).toBeNull()
  })
})
