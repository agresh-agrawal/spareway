// Trip history maths (owner request 3) and the "Download my data" CSV (backup). Pure.

export interface HistoryRow {
  tripId: string
  code: string
  status: string
  departure: string | null
  completedAt: string | null
  from: string
  to: string
  regNo: string
  driver: string
  stops: number
  cargoKg: number
  km: number
  freightInr: number
  extraInr: number
  routeCostInr: number
  extraCostInr: number
  miscInr: number
  challanInr: number
  netInr: number
}

/** Finished or cancelled trips, newest first. */
export function pastTrips(rows: HistoryRow[]): HistoryRow[] {
  return rows
    .filter((r) => r.status === 'completed' || r.status === 'cancelled')
    .sort((a, b) => (b.completedAt ?? b.departure ?? '').localeCompare(a.completedAt ?? a.departure ?? ''))
}

/** 'YYYY-MM' in India time (the month the trip finished, else left). */
export function monthOf(r: HistoryRow): string {
  const iso = r.completedAt ?? r.departure
  if (!iso) return ''
  const ist = new Date(new Date(iso).getTime() + 330 * 60_000)
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, '0')}`
}

export interface HistoryTotals {
  trips: number
  km: number
  netInr: number
  challanInr: number
  miscInr: number
}

/** Totals over completed trips only (cancelled trips earn nothing). */
export function historyTotals(rows: HistoryRow[]): HistoryTotals {
  const done = rows.filter((r) => r.status === 'completed')
  const sum = (k: 'km' | 'netInr' | 'challanInr' | 'miscInr') => Math.round(done.reduce((a, r) => a + r[k], 0))
  return { trips: done.length, km: sum('km'), netInr: sum('netInr'), challanInr: sum('challanInr'), miscInr: sum('miscInr') }
}

const cell = (v: string | number) => {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** All trips as CSV (opens in Excel / Google Sheets). */
export function historyCsv(rows: HistoryRow[]): string {
  const head = ['Trip', 'Status', 'Departure', 'Finished', 'From', 'To', 'Truck', 'Driver', 'Drops', 'Cargo kg', 'Km',
    'Freight ₹', 'Extra loads ₹', 'Route cost ₹', 'Extra-load cost ₹', 'Challans ₹', 'Other trip costs ₹', 'Net ₹']
  const lines = rows.map((r) =>
    [r.code, r.status, r.departure ?? '', r.completedAt ?? '', r.from, r.to, r.regNo, r.driver, r.stops, Math.round(r.cargoKg),
      Math.round(r.km), r.freightInr, r.extraInr, Math.round(r.routeCostInr), Math.round(r.extraCostInr), r.challanInr,
      r.miscInr - r.challanInr, Math.round(r.netInr)].map(cell).join(','),
  )
  return [head.map(cell).join(','), ...lines].join('\r\n') + '\r\n'
}
