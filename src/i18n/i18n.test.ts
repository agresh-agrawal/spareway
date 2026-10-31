import commonEn from './common/en.json'
import commonHi from './common/hi.json'
import dataHi from './data/hi.json'
import { setupI18n } from './setup'
import { td, tm } from '@/lib/i18n'

setupI18n('en')

function keys(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object') return [prefix]
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k))
}

const featureFiles = import.meta.glob<Record<string, unknown>>('../features/*/i18n/*.json', { eager: true, import: 'default' })

describe('en/hi key parity', () => {
  it('common', () => {
    expect(keys(commonHi).sort()).toEqual(keys(commonEn).sort())
  })

  const features = new Set(Object.keys(featureFiles).map((p) => p.split('/')[2]))
  it.each([...features])('feature %s', (f) => {
    const en = featureFiles[`../features/${f}/i18n/en.json`]
    const hi = featureFiles[`../features/${f}/i18n/hi.json`]
    expect(en, `${f} en.json`).toBeDefined()
    expect(hi, `${f} hi.json`).toBeDefined()
    expect(keys(hi).sort()).toEqual(keys(en).sort())
  })
})

describe('td() — demo data dictionary (Engineering Reference 7.6)', () => {
  it('translates every stored value when Hindi is on, and keeps it in English', () => {
    for (const [en, hi] of Object.entries(dataHi as Record<string, string>)) {
      expect(td(en, 'hi')).toBe(hi)
      expect(td(en, 'en')).toBe(en)
      expect(hi).not.toMatch(/\s{2,}/)
    }
  })
  it('leaves unknown and user-typed values as stored', () => {
    expect(td('My own godown', 'hi')).toBe('My own godown')
    expect(td('MP09 HG 4821', 'hi')).toBe('MP09 HG 4821')
    expect(td(null, 'hi')).toBe('')
  })
  it('covers the sample trucks, demo trip stops and cargo', () => {
    for (const v of ['Manesar warehouse', 'Jaipur (Sitapura)', 'Ahmedabad (Narol)', 'Mumbai (Bhiwandi)', 'LED TV 43 inch', 'Ramesh Yadav']) {
      expect(td(v, 'hi')).not.toBe(v)
    }
  })
})

describe('tm() — alert / activity templates (Engineering Reference 7.7)', () => {
  const cases: [string, Record<string, unknown>, string, string][] = [
    ['loader_issue', { code: 'TRP-2026-0031', step: 12, note: 'Box torn' }, 'Loader reported a problem — TRP-2026-0031 · step 12: Box torn', 'लोडर ने समस्या बताई — TRP-2026-0031 · स्टेप 12: Box torn'],
    ['loader_cargo', { code: 'TRP-2026-0031', count: 3, source: 'voice' }, 'Loader added cargo — TRP-2026-0031: 3 items by voice. Re-plan the load.', 'लोडर ने माल जोड़ा — TRP-2026-0031: आवाज़ से 3 सामान। लोड दोबारा प्लान करें।'],
    ['overload', { code: 'TRP-2026-0031', kg: '16 t', payloadKg: '15 t' }, 'Too heavy — TRP-2026-0031: 16 t of 15 t', 'वज़न ज़्यादा — TRP-2026-0031: 16 t / 15 t'],
    ['plan_unplaced', { code: 'TRP-2026-0031', count: 2 }, '2 items didn\'t fit in TRP-2026-0031', 'TRP-2026-0031 में 2 सामान नहीं आया'],
    ['city_entry', { code: 'TRP-2026-0031', city: 'Mumbai', from: '17:00', to: '21:00', wait: '2 h 20 min' }, 'TRP-2026-0031 reaches Mumbai in no-entry hours (17:00–21:00) — wait 2 h 20 min', 'TRP-2026-0031 मुंबई में नो-एंट्री समय (17:00–21:00) में पहुँचेगी — 2 h 20 min रुकें'],
    ['plan_activated', { version: 2, volumeUsedPct: 66 }, 'Load plan v2 in use — 66% space used', 'लोड प्लान v2 चालू — 66% जगह भरी'],
    ['extra_load_accepted', { listing_code: 'LD-1045', trip_code: 'TRP-2026-0031', pickup: 'Vadodara', drop: 'Mumbai (Bhiwandi)' }, 'Extra load LD-1045 added to TRP-2026-0031: Vadodara → Mumbai (Bhiwandi)', 'अतिरिक्त लोड LD-1045 TRP-2026-0031 में जोड़ा: वडोदरा → मुंबई (भिवंडी)'],
    ['trip_created', { code: 'TRP-2026-0032' }, 'New trip TRP-2026-0032', 'नई ट्रिप TRP-2026-0032'],
    ['truck_status', { reg: 'MP09 KR 1147', status: 'maintenance' }, 'MP09 KR 1147 is now Repair', 'MP09 KR 1147 अब मरम्मत'],
  ]
  it.each(cases)('%s in both languages', (kind, meta, en, hi) => {
    expect(tm(kind, meta, '', 'en')).toBe(en)
    expect(tm(kind, meta, '', 'hi')).toBe(hi)
  })

  it('seeded rows without meta fall back to the stored text through td()', () => {
    expect(tm('route_deviation', {}, 'Route deviation', 'hi')).toBe('रूट से भटका')
    expect(tm('trip_departed', {}, 'Trip departed Ahmedabad (Aslali)', 'hi')).toBe('ट्रिप अहमदाबाद (असलाली) से निकली')
  })
})
