import { readEnv } from './env'
import { toAppError } from './errors'
import {
  formatCargoSize,
  formatDateTime,
  formatDuration,
  formatFt,
  formatInr,
  formatKm,
  formatPct,
  formatRelative,
  formatTruckSize,
  formatWeight,
} from './format'
import { cmToFt, ftToCm, inToCm } from './units'
import { kmBetween } from './geo'

describe('env (build without .env)', () => {
  it('never throws; names what is missing', () => {
    expect(readEnv({})).toEqual({ env: null, missing: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] })
  })
  it('falls back to the OpenFreeMap style', () => {
    const { env } = readEnv({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'k' })
    expect(env?.mapStyleUrl).toContain('openfreemap')
  })
})

describe('format', () => {
  it('money with Indian grouping', () => {
    expect(formatInr(124500)).toBe('₹1,24,500')
    expect(formatInr(10450)).toBe('₹10,450')
    expect(formatInr(-1200)).toBe('−₹1,200')
  })
  it('truck size in feet', () => {
    expect(formatFt(975)).toBe('32.0 ft')
    expect(formatTruckSize(975, 243, 243)).toBe('32.0 ft × 8.0 ft × 8.0 ft')
  })
  it('cargo size in cm', () => {
    expect(formatCargoSize(95, 32, 38)).toBe('95 × 32 × 38 cm')
  })
  it('weight: kg, tonnes from 10,000 kg', () => {
    expect(formatWeight(2638)).toBe('2,638 kg')
    expect(formatWeight(15000)).toBe('15 t')
    expect(formatWeight(12400)).toBe('12.4 t')
  })
  it('distance, percent, duration', () => {
    expect(formatKm(1412.3)).toBe('1,412 km')
    expect(formatPct(66.4)).toBe('66%')
    expect(formatDuration(1600)).toBe('26 h 40 min')
    expect(formatDuration(1600, 'hi')).toBe('26 घं 40 मि')
  })
  it('IST date-time, 12-hour', () => {
    // 30 Oct 2026 12:30 UTC = 6:00 pm IST
    expect(formatDateTime('2026-10-30T12:30:00Z')).toBe('30 Oct, 6:00 pm')
  })
  it('relative time in both languages, Latin digits', () => {
    const now = new Date('2026-10-30T12:00:00Z')
    expect(formatRelative('2026-10-30T11:55:00Z', 'en', now)).toBe('5 min ago')
    expect(formatRelative('2026-10-30T11:55:00Z', 'hi', now)).toBe('5 मिनट पहले')
  })
})

describe('units', () => {
  it('ft ⇄ cm round trip', () => {
    expect(ftToCm(32)).toBe(975)
    expect(Math.round(cmToFt(975) * 10) / 10).toBe(32)
    expect(ftToCm(cmToFt(243))).toBe(243)
    expect(inToCm(10)).toBe(25.4)
  })
})

describe('geo', () => {
  it('Manesar → Jaipur ≈ 200 km straight line', () => {
    const d = kmBetween(28.354, 76.9366, 26.7787, 75.8306)
    expect(d).toBeGreaterThan(195)
    expect(d).toBeLessThan(210)
  })
})

describe('error mapping', () => {
  it.each([
    [{ code: 'invalid_credentials', message: 'Invalid login credentials' }, 'INVALID_LOGIN'],
    [{ code: 'email_not_confirmed', message: 'Email not confirmed' }, 'EMAIL_NOT_CONFIRMED'],
    [{ code: 'user_already_exists', message: 'User already registered' }, 'EMAIL_TAKEN'],
    [{ code: 'weak_password', message: 'Password should be' }, 'WEAK_PASSWORD'],
    [{ status: 429, message: 'Too many' }, 'RATE_LIMITED'],
    [{ name: 'TypeError', message: 'Failed to fetch' }, 'NETWORK'],
    [{ message: 'PLAN_NOT_FOUND' }, 'PLAN_NOT_FOUND'],
    [{ message: 'P0001: TRIP_NOT_FOUND' }, 'TRIP_NOT_FOUND'],
    [{ message: 'weird' }, 'UNKNOWN'],
  ])('%j → %s', (input, code) => {
    expect(toAppError(input).code).toBe(code)
  })
})
