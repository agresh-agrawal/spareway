// route-plan called only through its contract (Architecture 9.1), mocked: ok reply, error codes in the body,
// and non-2xx replies whose body still carries { ok: false, error: { code } }.
import { requestRoutes } from '../api'

const invoke = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase', () => ({ getSupabase: () => ({ functions: { invoke } }) }))

const truck = { internal_length_cm: 975, internal_width_cm: 243, internal_height_cm: 243, gross_weight_kg: 31000, payload_kg: 15000, axles: 3 } as never
const stops = [
  { seq: 0, lat: 28.354, lng: 76.9366 },
  { seq: 1, lat: 26.7787, lng: 75.8306 },
] as never
const route = { variant: 'fastest', distanceKm: 270, durationMin: 300, geometry: { type: 'LineString', coordinates: [[76.9, 28.3], [75.8, 26.7]] }, restricted: true, cached: false }

beforeEach(() => invoke.mockReset())

describe('requestRoutes', () => {
  it('sends the contract body and returns the routes', async () => {
    invoke.mockResolvedValue({ data: { ok: true, data: { routes: [route] } }, error: null })
    expect(await requestRoutes({ id: 't1' }, truck, stops)).toEqual([route])
    expect(invoke).toHaveBeenCalledWith('route-plan', {
      body: expect.objectContaining({ tripId: 't1', variants: ['fastest', 'shortest', 'no_tolls'], coordinates: [[76.9366, 28.354], [75.8306, 26.7787]] }),
    })
  })

  it('maps ORS_QUOTA from the body', async () => {
    invoke.mockResolvedValue({ data: { ok: false, error: { code: 'ORS_QUOTA', message: 'quota' } }, error: null })
    await expect(requestRoutes({ id: 't1' }, truck, stops)).rejects.toMatchObject({ code: 'ORS_QUOTA' })
  })

  it('reads the code from a non-2xx reply', async () => {
    const context = new Response(JSON.stringify({ ok: false, error: { code: 'ORS_ERROR', message: 'down' } }), { status: 502 })
    invoke.mockResolvedValue({ data: null, error: Object.assign(new Error('Edge Function returned a non-2xx status code'), { context }) })
    await expect(requestRoutes({ id: 't1' }, truck, stops)).rejects.toMatchObject({ code: 'ORS_ERROR' })
  })

  it('no session → NOT_SIGNED_IN; empty answer → ORS_ERROR', async () => {
    const context = new Response('Unauthorized', { status: 401 })
    invoke.mockResolvedValue({ data: null, error: Object.assign(new Error('401'), { context, status: 401 }) })
    await expect(requestRoutes({ id: 't1' }, truck, stops)).rejects.toMatchObject({ code: 'NOT_SIGNED_IN' })
    invoke.mockResolvedValue({ data: { ok: true, data: { routes: [] } }, error: null })
    await expect(requestRoutes({ id: 't1' }, truck, stops)).rejects.toMatchObject({ code: 'ORS_ERROR' })
  })
})
