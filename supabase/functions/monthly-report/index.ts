// monthly-report — owner request 6: on the 1st of each month every owner gets last month's trips, net earnings
// and tips to cut costs by email (Brevo). pg_cron calls it with a token kept in Vault (mode "cron"); an owner can
// also send / preview their own report from Settings (mode "me", user session).
// Secrets: BREVO_API_KEY, BREVO_SENDER ("Name <email>") as Edge Function secrets or in Vault (brevo_api_key,
// brevo_sender); optional APP_URL. Never logs secrets or emails.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { buildReport, monthRange, parseSender, previousMonth, renderEmail, type ReportTrip } from './lib.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-report-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
const fail = (status: number, code: string) => json(status, { ok: false, error: { code } })

async function tripsFor(admin: SupabaseClient, companyId: string, month: string): Promise<ReportTrip[]> {
  const { startIso, endIso } = monthRange(month)
  const { data, error } = await admin
    .from('trip_financials')
    .select('trip_id, code, status, completed_at, distance_km, base_freight_inr, extra_revenue_inr, route_cost_inr, extra_cost_inr, misc_cost_inr, challan_cost_inr, net_earnings_inr')
    .eq('company_id', companyId)
    .eq('status', 'completed')
    .gte('completed_at', startIso)
    .lt('completed_at', endIso)
  if (error) throw error
  const ids = (data ?? []).map((r) => r.trip_id)
  const space = new Map<string, number | null>()
  if (ids.length) {
    const { data: ov, error: oErr } = await admin.from('trip_overview').select('id, plan_volume_used_pct').in('id', ids)
    if (oErr) throw oErr
    for (const o of ov ?? []) space.set(o.id, o.plan_volume_used_pct === null ? null : Number(o.plan_volume_used_pct))
  }
  return (data ?? []).map((r) => ({
    code: r.code,
    status: r.status,
    completedAt: r.completed_at,
    km: Number(r.distance_km ?? 0),
    freightInr: Number(r.base_freight_inr ?? 0),
    extraInr: Number(r.extra_revenue_inr ?? 0),
    routeCostInr: Number(r.route_cost_inr ?? 0),
    extraCostInr: Number(r.extra_cost_inr ?? 0),
    miscInr: Number(r.misc_cost_inr ?? 0),
    challanInr: Number(r.challan_cost_inr ?? 0),
    netInr: Number(r.net_earnings_inr ?? 0),
    spacePct: space.get(r.trip_id) ?? null,
  }))
}

function prevOf(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

async function reportFor(admin: SupabaseClient, companyId: string, month: string) {
  const [trips, prev] = await Promise.all([tripsFor(admin, companyId, month), tripsFor(admin, companyId, prevOf(month))])
  const prevNet = prev.length ? prev.reduce((a, t) => a + t.netInr, 0) : null
  return buildReport(month, trips, prevNet)
}

async function sendBrevo(key: string, sender: { email: string; name: string }, to: { email: string; name: string }, subject: string, html: string) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': key, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ sender, to: [to.name ? to : { email: to.email }], subject, htmlContent: html }),
  })
  if (!res.ok) {
    console.error('brevo status', res.status)
    throw new Error('EMAIL_FAILED')
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return fail(405, 'BAD_REQUEST')

  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(url, service, { auth: { persistSession: false } })
  // Edge Function secrets first, else the values kept in Vault (report_email_config, service role only)
  let brevoKey = Deno.env.get('BREVO_API_KEY') ?? ''
  let senderRaw = Deno.env.get('BREVO_SENDER') ?? ''
  if (!brevoKey || !senderRaw) {
    const { data: cfg } = await admin.rpc('report_email_config')
    const c = (cfg ?? {}) as { apiKey?: string | null; sender?: string | null }
    brevoKey ||= c.apiKey ?? ''
    senderRaw ||= c.sender ?? ''
  }
  const sender = parseSender(senderRaw)
  const appUrl = (Deno.env.get('APP_URL') ?? 'https://spareway.vercel.app').replace(/\/$/, '')
  const emailReady = Boolean(brevoKey && sender)

  let body: { mode?: string; month?: string; dryRun?: boolean } = {}
  try {
    body = await req.json()
  } catch {
    return fail(400, 'BAD_REQUEST')
  }
  const month = body.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(body.month) ? body.month : previousMonth(new Date()).month

  // ---- scheduled run: every owner of every company with finished trips last month ----
  if (body.mode === 'cron') {
    const token = req.headers.get('x-report-token') ?? ''
    const { data: ok, error } = await admin.rpc('check_report_token', { p_token: token })
    if (error || ok !== true) return fail(401, 'AUTH_REQUIRED')
    if (!emailReady) return fail(503, 'EMAIL_NOT_SET_UP')
    const { data: companies, error: cErr } = await admin.from('companies').select('id, name')
    if (cErr) return fail(500, 'UNKNOWN')
    let sent = 0
    let failed = 0
    for (const c of companies ?? []) {
      try {
        const r = await reportFor(admin, c.id, month)
        if (r.trips === 0) continue
        const { data: owners } = await admin.from('profiles').select('email, full_name, preferred_lang').eq('company_id', c.id)
        for (const o of owners ?? []) {
          if (!o.email) continue
          const lang = o.preferred_lang === 'hi' ? 'hi' : 'en'
          const mail = renderEmail(r, lang, o.full_name ?? '', c.name, appUrl)
          await sendBrevo(brevoKey, sender!, { email: o.email, name: o.full_name ?? '' }, mail.subject, mail.html)
          sent++
        }
      } catch {
        failed++
      }
    }
    return json(200, { ok: true, month, sent, failed })
  }

  // ---- owner: preview / send my own report ----
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false } })
  const { data: u, error: uErr } = await userClient.auth.getUser(jwt)
  if (uErr || !u.user) return fail(401, 'AUTH_REQUIRED')
  if (body.mode === 'status') return json(200, { ok: true, emailReady })

  const { data: prof } = await admin.from('profiles').select('company_id, email, full_name, preferred_lang').eq('id', u.user.id).maybeSingle()
  if (!prof) return fail(404, 'NOT_SIGNED_IN')
  const { data: company } = await admin.from('companies').select('name').eq('id', prof.company_id).maybeSingle()
  const r = await reportFor(admin, prof.company_id, month)
  const lang = prof.preferred_lang === 'hi' ? 'hi' : 'en'
  const mail = renderEmail(r, lang, prof.full_name ?? '', company?.name ?? '', appUrl)
  if (body.dryRun) return json(200, { ok: true, month, report: r, subject: mail.subject, html: mail.html, emailReady })
  if (!emailReady) return fail(503, 'EMAIL_NOT_SET_UP')
  const to = prof.email || u.user.email || ''
  if (!to) return fail(400, 'BAD_REQUEST')
  try {
    await sendBrevo(brevoKey, sender!, { email: to, name: prof.full_name ?? '' }, mail.subject, mail.html)
  } catch {
    return fail(502, 'EMAIL_FAILED')
  }
  return json(200, { ok: true, month, sentTo: to })
})
