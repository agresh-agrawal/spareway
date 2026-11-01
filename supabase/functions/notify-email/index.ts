// notify-email — the email half of the notification bar. pg_cron calls it every 10 minutes (mode "cron", Vault
// token) when there are unsent important notifications; each company's owners who left "Email me important
// changes" on get one digest. An owner can preview / send a test from Settings (mode "test", user session).
// Brevo key + sender: Edge Function secrets or Vault (report_email_config), as in monthly-report. Never logs secrets.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { renderDigest, type Notice } from './lib.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-report-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
const fail = (status: number, code: string) => json(status, { ok: false, error: { code } })

function parseSender(raw: string): { email: string; name: string } | null {
  const s = raw.trim()
  const m = s.match(/^(.*)<([^>]+)>$/)
  const email = (m ? m[2] : s).trim()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return null
  return { email, name: (m ? m[1].trim().replace(/^"|"$/g, '') : '') || 'Spareway' }
}

type Row = { id: string; company_id: string; kind: string; severity: string; title: string; meta: Record<string, unknown>; link: string; created_at: string }
const toNotice = (r: Row): Notice => ({ kind: r.kind, severity: r.severity, title: r.title, meta: r.meta ?? {}, link: r.link, createdAt: r.created_at })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return fail(405, 'BAD_REQUEST')
  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
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

  const send = async (to: { email: string; name: string }, subject: string, html: string) => {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': brevoKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ sender, to: [to.name ? to : { email: to.email }], subject, htmlContent: html }),
    })
    if (!res.ok) {
      console.error('brevo status', res.status)
      throw new Error('EMAIL_FAILED')
    }
  }

  let body: { mode?: string; dryRun?: boolean } = {}
  try {
    body = await req.json()
  } catch {
    return fail(400, 'BAD_REQUEST')
  }

  if (body.mode === 'cron') {
    const { data: ok, error } = await admin.rpc('check_report_token', { p_token: req.headers.get('x-report-token') ?? '' })
    if (error || ok !== true) return fail(401, 'AUTH_REQUIRED')
    if (!brevoKey || !sender) return fail(503, 'EMAIL_NOT_SET_UP')
    const since = new Date(Date.now() - 24 * 3_600_000).toISOString()
    const { data: rows, error: nErr } = await admin
      .from('notifications')
      .select('id, company_id, kind, severity, title, meta, link, created_at')
      .eq('major', true)
      .eq('is_sample', false)
      .is('emailed_at', null)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(500)
    if (nErr) return fail(500, 'UNKNOWN')
    const byCompany = new Map<string, Row[]>()
    for (const r of (rows ?? []) as Row[]) byCompany.set(r.company_id, [...(byCompany.get(r.company_id) ?? []), r])
    let sent = 0
    let failed = 0
    for (const [companyId, list] of byCompany) {
      const [{ data: company }, { data: owners }] = await Promise.all([
        admin.from('companies').select('name').eq('id', companyId).maybeSingle(),
        admin.from('profiles').select('email, full_name, preferred_lang, email_notify').eq('company_id', companyId),
      ])
      let allOk = true
      for (const o of owners ?? []) {
        if (!o.email || !o.email_notify) continue
        const lang = o.preferred_lang === 'hi' ? 'hi' : 'en'
        const mail = renderDigest(list.slice(0, 20).map(toNotice), lang, o.full_name ?? '', company?.name ?? '', appUrl)
        try {
          await send({ email: o.email, name: o.full_name ?? '' }, mail.subject, mail.html)
          sent++
        } catch {
          failed++
          allOk = false
        }
      }
      // sent (or nobody wants email): never send these again; a failed send is retried on the next run
      if (allOk) await admin.from('notifications').update({ emailed_at: new Date().toISOString() }).in('id', list.map((r) => r.id))
    }
    return json(200, { ok: true, sent, failed })
  }

  // ---- owner: preview / send a test with my latest important notifications ----
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false } })
  const { data: u, error: uErr } = await userClient.auth.getUser(jwt)
  if (uErr || !u.user) return fail(401, 'AUTH_REQUIRED')
  const { data: prof } = await admin.from('profiles').select('company_id, email, full_name, preferred_lang').eq('id', u.user.id).maybeSingle()
  if (!prof) return fail(404, 'NOT_SIGNED_IN')
  const [{ data: company }, { data: rows }] = await Promise.all([
    admin.from('companies').select('name').eq('id', prof.company_id).maybeSingle(),
    admin
      .from('notifications')
      .select('id, company_id, kind, severity, title, meta, link, created_at')
      .eq('company_id', prof.company_id)
      .order('created_at', { ascending: false })
      .limit(5),
  ])
  const list = ((rows ?? []) as Row[]).map(toNotice)
  if (list.length === 0) return fail(404, 'NOTHING_TO_SEND')
  const lang = prof.preferred_lang === 'hi' ? 'hi' : 'en'
  const mail = renderDigest(list, lang, prof.full_name ?? '', company?.name ?? '', appUrl)
  if (body.dryRun) return json(200, { ok: true, subject: mail.subject, html: mail.html })
  if (!brevoKey || !sender) return fail(503, 'EMAIL_NOT_SET_UP')
  const to = prof.email || u.user.email || ''
  try {
    await send({ email: to, name: prof.full_name ?? '' }, mail.subject, mail.html)
  } catch {
    return fail(502, 'EMAIL_FAILED')
  }
  return json(200, { ok: true, sentTo: to })
})
