// ai-cargo — cargo lines from photos (Gemini vision) or a voice transcript. Architecture F17/F18, Engineering Reference 6.2.
// Owner (user session, must own tripId) or loader (loaderToken, checked with loader_trip_for_token).
// Secrets: GEMINI_API_KEY (+ optional GEMINI_API_KEY_1 fallback), GEMINI_MODEL. Never logs secrets or photos.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { geminiBody, parseGemini, parseRequest, warningsFor, type AiItem } from './lib.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
const fail = (status: number, code: string, message: string) => json(status, { ok: false, error: { code, message } })

const TIMEOUT_MS = 45_000

async function callGemini(keys: string[], model: string, body: unknown): Promise<{ reply: unknown } | { error: 'AI_TIMEOUT' | 'AI_PARSE' }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
  for (const key of keys) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      })
      const reply = await res.json().catch(() => null)
      if (res.ok) return { reply }
      // quota / server trouble → try the next key; anything else is a bad answer
      if (res.status === 429 || res.status >= 500) continue
      console.error('gemini status', res.status)
      return { error: 'AI_PARSE' }
    } catch {
      return { error: 'AI_TIMEOUT' }
    } finally {
      clearTimeout(timer)
    }
  }
  return { error: 'AI_TIMEOUT' }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return fail(405, 'BAD_REQUEST', 'Use POST')

  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const keys = [Deno.env.get('GEMINI_API_KEY'), Deno.env.get('GEMINI_API_KEY_1')].filter((k): k is string => Boolean(k))
  const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.5-flash'

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return fail(400, 'BAD_REQUEST', 'Body must be JSON')
  }
  const parsed = parseRequest(body)
  if (!parsed.ok) return fail(parsed.code === 'TOO_LARGE' ? 413 : 400, parsed.code, parsed.message)
  const input = parsed.value
  const admin = createClient(url, service, { auth: { persistSession: false } })

  // 1. who is asking: a loader link first (loaders have no session), else the owner's session
  let tripId: string
  let companyId: string
  let userId: string | null = null
  const viaLoader = Boolean(input.loaderToken)
  if (input.loaderToken) {
    const { data } = await admin.rpc('loader_trip_for_token', { p_token: input.loaderToken })
    const row = Array.isArray(data) ? data[0] : data
    if (!row?.trip_id) return fail(403, 'LINK_INVALID', 'This loading link has expired or was turned off')
    tripId = row.trip_id
    companyId = row.company_id
  } else {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!jwt) return fail(401, 'AUTH_REQUIRED', 'Please log in again')
    const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false } })
    const { data: u, error: uErr } = await userClient.auth.getUser(jwt)
    if (uErr || !u?.user) return fail(401, 'AUTH_REQUIRED', 'Please log in again')
    const { data: trip } = await userClient.from('trips').select('id, company_id').eq('id', input.tripId!).maybeSingle()
    if (!trip) return fail(404, 'TRIP_NOT_FOUND', 'This trip no longer exists')
    tripId = trip.id
    companyId = trip.company_id
    userId = u.user.id
  }

  // 2. keep the photos (private bucket, company folder)
  const imagePaths: string[] = []
  if (input.mode === 'image') {
    for (const im of input.images) {
      const ext = im.mime === 'image/png' ? 'png' : im.mime === 'image/webp' ? 'webp' : 'jpg'
      const path = `${companyId}/${tripId}/${crypto.randomUUID()}.${ext}`
      const bytes = Uint8Array.from(atob(im.base64), (c) => c.charCodeAt(0))
      const { error } = await admin.storage.from('cargo-images').upload(path, bytes, { contentType: im.mime })
      if (!error) imagePaths.push(path)
    }
  }

  const scan = {
    company_id: companyId,
    trip_id: tripId,
    kind: input.mode,
    via_loader: viaLoader,
    input_paths: imagePaths,
    transcript: input.mode === 'voice' ? input.transcript : '',
    model,
    created_by: userId,
  }

  // 3. ask Gemini for JSON in our schema
  if (keys.length === 0) {
    await admin.from('ai_scans').insert({ ...scan, status: 'failed', warnings: ['NO_KEY'] })
    return fail(503, 'AI_TIMEOUT', 'Reading photos is not set up')
  }
  const result = await callGemini(keys, model, geminiBody(input))
  let items: AiItem[] | null = null
  if ('reply' in result) items = parseGemini(result.reply)
  if (!items) {
    const code = 'error' in result ? result.error : 'AI_PARSE'
    await admin.from('ai_scans').insert({ ...scan, status: 'failed', warnings: [code], raw_response: 'reply' in result ? (result.reply as object) : {} })
    return fail(502, code, "Couldn't read that — try again or type it")
  }
  const warnings = warningsFor(items, input.mode)

  const { data: row } = await admin
    .from('ai_scans')
    .insert({ ...scan, status: 'parsed', raw_response: result.reply as object, parsed_items: items, warnings })
    .select('id')
    .single()

  return json(200, { ok: true, data: { scanId: row?.id ?? null, model, imagePaths, items, warnings } })
})
