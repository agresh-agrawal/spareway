// photo-cleanup — photo retention (privacy). pg_cron calls it once a day with the Vault token (x-report-token).
// 1. Cargo photos older than 30 days are deleted from the private cargo-images bucket; the AI result (items,
//    sizes) stays, the scan and the cargo rows just lose the photo path.
// 2. Photos of a company that no longer exists (account deleted) are deleted, whatever their age.
// Storage objects can only be removed through the Storage API, so this is an Edge Function and not SQL.
import { createClient } from 'npm:@supabase/supabase-js@2'

const KEEP_DAYS = 30
const BUCKET = 'cargo-images'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: { code: 'BAD_REQUEST' } })
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })
  const { data: ok, error } = await admin.rpc('check_report_token', { p_token: req.headers.get('x-report-token') ?? '' })
  if (error || ok !== true) return json(401, { ok: false, error: { code: 'AUTH_REQUIRED' } })

  let removed = 0
  const remove = async (paths: string[]) => {
    for (let i = 0; i < paths.length; i += 100) {
      const part = paths.slice(i, i + 100)
      const { error: rmErr } = await admin.storage.from(BUCKET).remove(part)
      if (rmErr) throw new Error('REMOVE_FAILED')
      removed += part.length
    }
  }

  try {
    // 1. old scans
    const before = new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString()
    const { data: scans, error: sErr } = await admin
      .from('ai_scans')
      .select('id, input_paths')
      .lt('created_at', before)
      .neq('input_paths', '{}')
      .limit(500)
    if (sErr) throw new Error('READ_FAILED')
    const old = (scans ?? []) as { id: string; input_paths: string[] }[]
    const paths = old.flatMap((s) => s.input_paths ?? [])
    if (paths.length > 0) {
      await remove(paths)
      await admin.from('ai_scans').update({ input_paths: [] }).in('id', old.map((s) => s.id))
      await admin.from('cargo_items').update({ image_path: null }).in('image_path', paths)
    }

    // 2. folders of deleted companies
    const { data: folders } = await admin.storage.from(BUCKET).list('', { limit: 1000 })
    const ids = (folders ?? []).map((f) => f.name).filter((n) => /^[0-9a-f-]{36}$/.test(n))
    if (ids.length > 0) {
      const { data: alive } = await admin.from('companies').select('id').in('id', ids)
      const keep = new Set((alive ?? []).map((c: { id: string }) => c.id))
      for (const company of ids.filter((id) => !keep.has(id))) {
        const { data: trips } = await admin.storage.from(BUCKET).list(company, { limit: 1000 })
        for (const t of trips ?? []) {
          const { data: files } = await admin.storage.from(BUCKET).list(`${company}/${t.name}`, { limit: 1000 })
          await remove((files ?? []).map((f) => `${company}/${t.name}/${f.name}`))
        }
      }
    }
  } catch (e) {
    console.error('photo-cleanup', (e as Error).message)
    return json(500, { ok: false, error: { code: 'UNKNOWN' }, removed })
  }
  return json(200, { ok: true, removed })
})
