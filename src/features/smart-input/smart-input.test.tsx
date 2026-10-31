// Smart input in fixture mode: typed "voice" → missing height question → Check items → owner insert; loader insert + alert;
// validator; slots; Hindi labels.
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { fakeAuth, renderAt } from '@/test/renderWithAuth'
import { fixtureStore, resetFixtureStore } from '@/lib/fixtures'
import { applyLang } from '@/lib/i18n'
import { getModules, slotEntries } from '@/app/modules'
import { addAsLoader, FIXTURE_SCAN } from './api'
import { OwnerSmartAdd } from './components/SmartAdd'
import { allValid, rowErrors, rowWarnings, toRows, fitSize } from './lib/validate'

vi.mock('@/lib/realtime', () => ({ useRealtime: () => {} }))

const DEMO = '00000000-0000-4000-8000-000000000031'
const auth = fakeAuth({ status: 'ready' })

beforeAll(() => window.history.replaceState(null, '', '/?fixture=seed'))
afterAll(() => window.history.replaceState(null, '', '/?fixture=off'))
beforeEach(() => {
  resetFixtureStore(new Date('2026-10-31T06:00:00Z'))
  applyLang('en', false)
})

describe('validator — reports, never changes values', () => {
  const [a, b] = toRows(FIXTURE_SCAN.items)
  it('keeps the suggested values exactly', () => {
    expect([a.lengthCm, a.widthCm, a.heightCm, a.quantity, a.confidence]).toEqual([60, 40, 45, 16, 0.82])
    expect(Number.isNaN(a.weightKg)).toBe(true)
  })
  it('kg and drop stop are required', () => {
    expect(rowErrors(a)).toEqual(['weight', 'drop'])
    expect(allValid([{ ...a, weightKg: 12, dropStopId: 's1' }])).toBe(true)
  })
  it('counts across photos and unusual sizes are warnings', () => {
    expect(rowWarnings(a)).toEqual(['countMismatch'])
    expect(rowWarnings({ ...b, lengthCm: 450, confidence: 0.3 })).toEqual(['sizeRange', 'lowConfidence'])
    expect(rowErrors({ ...b, heightCm: 0, weightKg: 5, dropStopId: 's' })).toEqual(['size'])
  })
  it('photos shrink to ≤ 1280 px', () => {
    expect(fitSize(4000, 3000)).toEqual({ w: 1280, h: 960 })
    expect(fitSize(800, 600)).toEqual({ w: 800, h: 600 })
  })
})

describe('owner flow (typed, because jsdom has no speech)', () => {
  it('Speak → type → asks the height → Check items → Add → cargo_items with source voice', async () => {
    const before = fixtureStore().cargo_items.filter((c) => c.trip_id === DEMO).length
    renderAt(<OwnerSmartAdd tripId={DEMO} />, { path: '/', at: '/', auth })
    fireEvent.click(screen.getByRole('button', { name: 'Speak' }))
    expect(await screen.findByText(/Speaking works in Chrome or Edge/)).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'दस बाई दस का बॉक्स, पचास पीस, नाज़ुक है' } })
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(await screen.findByText('How high is it?')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Answer'), { target: { value: 'बीस' } })
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))

    const line = await screen.findByRole('region', { name: 'Line 1' })
    expect(within(line).getByLabelText('Height')).toHaveValue(20)
    expect(within(line).getByRole('button', { name: /Fragile/ })).toHaveAttribute('aria-pressed', 'true')

    // nothing saved before confirm; kg + drop are required
    fireEvent.click(screen.getByRole('button', { name: 'Add 50 items' }))
    expect(await within(line).findByText('Enter the weight of one piece')).toBeInTheDocument()
    expect(fixtureStore().cargo_items.filter((c) => c.trip_id === DEMO)).toHaveLength(before)

    fireEvent.change(within(line).getByLabelText('Weight each'), { target: { value: '2' } })
    const drop = within(line).getByLabelText('Drop at') as HTMLSelectElement
    fireEvent.change(drop, { target: { value: drop.options[1].value } })
    fireEvent.click(screen.getByRole('button', { name: 'Add 50 items' }))

    await waitFor(() => expect(fixtureStore().cargo_items.filter((c) => c.trip_id === DEMO)).toHaveLength(before + 1))
    const added = fixtureStore().cargo_items.at(-1)!
    expect(added).toMatchObject({ label: 'Box', length_cm: 10, width_cm: 10, height_cm: 20, quantity: 50, weight_kg: 2, fragile: true, source: 'voice', added_by_loader: false })
  })

  it('Hindi labels', async () => {
    act(() => applyLang('hi', false))
    renderAt(<OwnerSmartAdd tripId={DEMO} />, { path: '/', at: '/', auth })
    expect(screen.getByRole('button', { name: 'कैमरे से स्कैन करें' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'बोलकर जोड़ें' }))
    expect(await screen.findByRole('dialog', { name: 'माल बोलकर बताएँ' })).toBeInTheDocument()
  })
})

describe('loader flow', () => {
  it('loader_add_cargo adds rows marked by the loader and one "Loader added cargo" alert', async () => {
    const d = fixtureStore()
    const trip = d.trips.find((t) => t.id === DEMO)!
    trip.loader_token = 'tok-1'
    const drop = d.trip_stops.find((s) => s.trip_id === DEMO && s.stop_type !== 'origin')!
    const rows = toRows(FIXTURE_SCAN.items, drop.id).map((r) => ({ ...r, weightKg: 9 }))
    expect(await addAsLoader('tok-1', rows, 'camera', { imagePaths: ['c/t/a.jpg'] })).toBe(2)
    const mine = d.cargo_items.filter((c) => c.added_by_loader && c.trip_id === DEMO)
    expect(mine.map((c) => [c.quantity, c.source, c.image_path])).toEqual([
      [16, 'camera', 'c/t/a.jpg'],
      [6, 'camera', 'c/t/a.jpg'],
    ])
    expect(d.alerts.at(-1)).toMatchObject({ kind: 'loader_cargo', meta: { code: trip.code, count: 2, source: 'camera' } })
    await expect(addAsLoader('nope', rows, 'voice', { imagePaths: [] })).rejects.toMatchObject({ code: 'LINK_INVALID' })
  })
})

describe('slots', () => {
  it('plugs into the cargo list and the loader page', () => {
    expect(slotEntries(getModules(), 'cargo.addMethods', { tripId: DEMO }).map((e) => e.id)).toContain('smart-input')
    expect(slotEntries(getModules(), 'loader.actions', { token: 't', job: {} as never }).map((e) => e.id)).toContain('smart-input')
  })
})
