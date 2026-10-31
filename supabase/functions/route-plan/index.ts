// route-plan — truck routes from OpenRouteService through a secure, cached server function.
// Architecture F14 / 9.1. Owners only (valid user session). Secret: ORS_API_KEY. Never logs secrets.
import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  cacheInput,
  isNoRoute,
  isQuota,
  orsBody,
  parseOrs,
  parseRequest,
  type RouteOut,
  type Variant,
} from './lib.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
const fail = (status: number, code: string, message: string) => json(status, { ok: false, error: { code, message } })

const ORS_URL = 'https://api.openrouteservice.org/v2/directions/driving-hgv/geojson'

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return fail(405, 'BAD_REQUEST', 'Use POST')

  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const orsKey = Deno.env.get('ORS_API_KEY')

  // 1. owner session required
  const auth = req.headers.get('Authorization') ?? ''
  const jwt = auth.replace(/^Bearer\s+/i, '')
  if (!jwt) return fail(401, 'AUTH_REQUIRED', 'Please log in again')
  const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false } })
  const { data: userData, error: userErr } = await userClient.auth.getUser(jwt)
  if (userErr || !userData?.user) return fail(401, 'AUTH_REQUIRED', 'Please log in again')

  // 2. input
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return fail(400, 'BAD_REQUEST', 'Body must be JSON')
  }
  const parsed = parseRequest(body)
  if (!parsed.ok) return fail(400, 'BAD_REQUEST', parsed.message)
  const { tripId, coordinates, variants, truck } = parsed.value

  // the trip must belong to the caller (RLS on the user client)
  const { data: trip } = await userClient.from('trips').select('id').eq('id', tripId).maybeSingle()
  if (!trip) return fail(404, 'TRIP_NOT_FOUND', 'This trip or plan no longer exists')

  const admin = createClient(url, service, { auth: { persistSession: false } })
  const routes: RouteOut[] = []
  let quota = false
  let orsDown = false

  // 3. one variant after another (ORS limits 40/min)
  for (const variant of variants as Variant[]) {
    const key = await sha256(cacheInput(variant, coordinates, truck))
    const { data: hit } = await admin.from('route_cache').select('response').eq('key', key).maybeSingle()
    if (hit?.response) {
      routes.push({ ...(hit.response as RouteOut), variant, cached: true })
      continue
    }
    if (!orsKey || quota || orsDown) {
      orsDown = orsDown || !orsKey
      continue
    }
    let restricted = true
    let result: ReturnType<typeof parseOrs> = null
    for (const attempt of [true, false]) {
      restricted = attempt
      let res: Response
      try {
        res = await fetch(ORS_URL, {
          method: 'POST',
          headers: { Authorization: orsKey, 'Content-Type': 'application/json', Accept: 'application/geo+json' },
          body: JSON.stringify(orsBody(variant, coordinates, truck, attempt)),
        })
      } catch {
        orsDown = true
        break
      }
      const payload = await res.json().catch(() => null)
      if (res.ok) {
        result = parseOrs(payload)
        break
      }
      if (isQuota(res.status, payload)) {
        quota = true
        break
      }
      if (attempt && isNoRoute(res.status, payload)) continue // retry without truck restrictions
      orsDown = true
      break
    }
    if (!result) continue
    const out: RouteOut = {
      variant,
      distanceKm: result.distanceKm,
      durationMin: result.durationMin,
      geometry: { type: 'LineString', coordinates: result.coordinates },
      restricted,
      cached: false,
    }
    routes.push(out)
    await admin.from('route_cache').upsert({ key, response: out })
  }

  if (routes.length === 0) {
    if (quota) return fail(429, 'ORS_QUOTA', 'Routes are unavailable right now — showing saved routes')
    return fail(502, 'ORS_ERROR', 'Routes are unavailable right now — showing saved routes')
  }
  return json(200, { ok: true, data: { routes, ...(quota ? { warning: 'ORS_QUOTA' } : orsDown ? { warning: 'ORS_ERROR' } : {}) } })
})
