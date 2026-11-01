// Smart input data (Architecture F17/F18): ai-cargo calls, owner insert into cargo_items, loader insert through loader_add_cargo.
// Fixture mode (?fixture=seed, dev only): a mocked ai-cargo answer (Engineering Reference 6.2 example) and in-memory inserts.
import { getSupabase } from '@/lib/supabase'
import { AppError, throwIfDataError, toAppError } from '@/lib/errors'
import { fixtureDelay, fixtureStore, FIXTURE_COMPANY_ID, isFixtureMode } from '@/lib/fixtures'
import type { Lang, LoaderCargoRow } from '@/types/domain'
import type { PhotoIn } from './lib/image'
import type { CheckRow, SuggestedItem } from './lib/validate'
import { parseVoice } from './voice/parse'
import { guardCargo, integrityDefaults, logChange } from '@/features/cargo'

export type Who = { tripId: string; loaderToken?: undefined } | { loaderToken: string; tripId?: undefined }
export type Source = 'camera' | 'voice'

export interface AiResult {
  scanId: string | null
  imagePaths: string[]
  items: SuggestedItem[]
  warnings: string[]
}

type Reply =
  { ok: true; data: AiResult & { model: string } } | { ok: false; error: { code: string; message?: string } }

export const A4 = { name: 'A4 sheet', lengthCm: 29.7, widthCm: 21 }

/** Example answer from Engineering Reference 6.2 (+ a second line) — fixture mode and tests only. */
export const FIXTURE_SCAN: AiResult = {
  scanId: null,
  imagePaths: [],
  items: [
    {
      label: 'Carton',
      lengthCm: 60,
      widthCm: 40,
      heightCm: 45,
      quantity: 16,
      fragile: false,
      uprightOnly: false,
      stackable: true,
      confidence: 0.82,
      notes: '',
      countsPerView: [16, 15],
    },
    {
      label: 'Carton',
      lengthCm: 30,
      widthCm: 30,
      heightCm: 30,
      quantity: 6,
      fragile: true,
      uprightOnly: false,
      stackable: true,
      confidence: 0.64,
      notes: 'Glass marks',
      countsPerView: [6, 6],
    },
  ],
  warnings: ['COUNT_MISMATCH'],
}

async function callAi(body: Record<string, unknown>): Promise<AiResult> {
  const { data, error } = await getSupabase().functions.invoke<Reply>('ai-cargo', { body })
  let reply = data
  if (error) {
    // non-2xx: the function still answers { ok: false, error: { code } } in the body
    const ctx = (error as { context?: unknown }).context
    if (ctx instanceof Response) reply = (await ctx.json().catch(() => null)) as Reply | null
    if (!reply) throw toAppError(error)
  }
  if (!reply) throw new AppError('AI_PARSE')
  if (!reply.ok) throw toAppError({ message: reply.error.code })
  return reply.data
}

const whoBody = (who: Who) => ({ tripId: who.tripId ?? null, loaderToken: who.loaderToken ?? null })

export async function analysePhotos(who: Who, photos: PhotoIn[], lang: Lang): Promise<AiResult> {
  if (isFixtureMode()) return fixtureDelay(structuredClone(FIXTURE_SCAN), 1200)
  return callAi({
    mode: 'image',
    ...whoBody(who),
    images: photos.map((p) => ({ base64: p.base64, mime: p.mime })),
    reference: A4,
    lang,
  })
}

/** Voice mode on the server — only used when the rule parser is unsure. */
export async function analyseWords(who: Who, transcript: string, lang: Lang): Promise<AiResult> {
  if (isFixtureMode()) {
    const r = parseVoice(transcript)
    return fixtureDelay({ scanId: null, imagePaths: [], items: r.items, warnings: [] }, 600)
  }
  return callAi({ mode: 'voice', ...whoBody(who), transcript, lang })
}

const toLoaderRow = (r: CheckRow, imagePath?: string): LoaderCargoRow => ({
  label: r.label.trim(),
  lengthCm: r.lengthCm,
  widthCm: r.widthCm,
  heightCm: r.heightCm,
  weightKg: r.weightKg,
  quantity: r.quantity,
  dropStopId: r.dropStopId,
  fragile: r.fragile,
  uprightOnly: r.uprightOnly,
  stackable: r.stackable,
  ...(imagePath ? { imagePath } : {}),
  confidence: r.confidence,
})

/** Owner: insert the checked rows (source camera/voice) and mark the scan confirmed. */
export async function addAsOwner(
  tripId: string,
  rows: CheckRow[],
  source: Source,
  scan: { scanId: string | null; imagePaths: string[] },
): Promise<number> {
  const imagePath = scan.imagePaths[0] ?? null
  const insert = rows.map((r) => ({
    trip_id: tripId,
    label: r.label.trim(),
    length_cm: r.lengthCm,
    width_cm: r.widthCm,
    height_cm: r.heightCm,
    weight_kg: r.weightKg,
    quantity: r.quantity,
    drop_stop_id: r.dropStopId,
    fragile: r.fragile,
    upright_only: r.uprightOnly,
    stackable: r.stackable,
    source,
    image_path: imagePath,
    confidence: r.confidence,
  }))
  if (isFixtureMode()) {
    const d = fixtureStore()
    // one insert in the database: every line passes the guard or none is added
    const checked = insert.map((row) =>
      guardCargo(
        d,
        {
          ...row,
          ...integrityDefaults,
          id: crypto.randomUUID(),
          company_id: FIXTURE_COMPANY_ID,
          sku: '',
          client_name: '',
          pickup_stop_id: null,
          max_top_load_kg: null,
          priority: 'normal',
          added_by_loader: false,
          extra_load_id: null,
          created_at: new Date().toISOString(),
        },
        { actor: 'owner', log: false },
      ),
    )
    for (const c of checked) {
      d.cargo_items.push(c)
      logChange(d, 'insert', undefined, c, 'owner')
    }
    return fixtureDelay(insert.length)
  }
  const sb = getSupabase()
  const { error } = await sb.from('cargo_items').insert(insert)
  if (error) throw toAppError(error)
  if (scan.scanId)
    await sb
      .from('ai_scans')
      .update({ status: 'confirmed', parsed_items: rows as never })
      .eq('id', scan.scanId)
  return insert.length
}

/** Loader (no login): loader_add_cargo → the owner gets a "Loader added cargo" alert. */
export async function addAsLoader(
  token: string,
  rows: CheckRow[],
  source: Source,
  scan: { imagePaths: string[] },
): Promise<number> {
  const items = rows.map((r) => toLoaderRow(r, scan.imagePaths[0]))
  if (isFixtureMode()) {
    const d = fixtureStore()
    const t = d.trips.find((x) => x.loader_token === token)
    if (!t) throw new AppError('LINK_INVALID')
    const now = new Date().toISOString()
    const checked = items.map((it) =>
      guardCargo(
        d,
        {
          ...integrityDefaults,
          id: crypto.randomUUID(),
          company_id: FIXTURE_COMPANY_ID,
          trip_id: t.id,
          label: it.label,
          sku: '',
          client_name: '',
          length_cm: it.lengthCm,
          width_cm: it.widthCm,
          height_cm: it.heightCm,
          weight_kg: it.weightKg,
          quantity: it.quantity,
          pickup_stop_id: null,
          drop_stop_id: it.dropStopId,
          fragile: it.fragile,
          upright_only: it.uprightOnly,
          stackable: it.stackable,
          max_top_load_kg: null,
          priority: 'normal',
          source,
          added_by_loader: true,
          extra_load_id: null,
          image_path: it.imagePath ?? null,
          confidence: it.confidence ?? null,
          created_at: now,
        },
        { actor: 'loader', log: false },
      ),
    )
    for (const c of checked) {
      d.cargo_items.push(c)
      logChange(d, 'insert', undefined, c, 'loader')
    }
    d.alerts.push({
      id: crypto.randomUUID(),
      company_id: FIXTURE_COMPANY_ID,
      truck_id: null,
      trip_id: t.id,
      kind: 'loader_cargo',
      severity: 'info',
      title: 'Loader added cargo',
      message: `${t.code}: ${items.length} item line(s) added by ${source} — re-plan the load`,
      meta: { code: t.code, count: items.length, source },
      resolved: false,
      resolved_at: null,
      is_sample: false,
      created_at: now,
    })
    return fixtureDelay(items.length)
  }
  const { data, error } = await getSupabase().rpc('loader_add_cargo', {
    p_token: token,
    p_items: items as never,
    p_source: source,
  })
  if (error) throw toAppError(error)
  const res = throwIfDataError(data) as { added?: number } | null
  return res?.added ?? items.length
}

export interface LoaderItem extends LoaderCargoRow {
  id: string
  source: string
}

/** Items this loader added on this link's trip (loader_my_cargo). */
export async function listLoaderItems(token: string): Promise<LoaderItem[]> {
  if (isFixtureMode()) {
    const d = fixtureStore()
    const t = d.trips.find((x) => x.loader_token === token)
    if (!t) throw new AppError('LINK_INVALID')
    return fixtureDelay(
      d.cargo_items
        .filter((c) => c.trip_id === t.id && c.added_by_loader)
        .map((c) => ({
          id: c.id,
          label: c.label,
          lengthCm: Number(c.length_cm),
          widthCm: Number(c.width_cm),
          heightCm: Number(c.height_cm),
          weightKg: Number(c.weight_kg),
          quantity: c.quantity,
          dropStopId: c.drop_stop_id,
          fragile: c.fragile,
          uprightOnly: c.upright_only,
          stackable: c.stackable,
          source: c.source,
          confidence: c.confidence ?? undefined,
        })),
    )
  }
  const { data, error } = await getSupabase().rpc('loader_my_cargo', { p_token: token })
  if (error) throw toAppError(error)
  return throwIfDataError(data) as unknown as LoaderItem[]
}

/** Correct one item the loader added (loader_update_cargo). */
export async function updateLoaderItem(token: string, id: string, row: CheckRow): Promise<void> {
  const item = toLoaderRow(row)
  if (isFixtureMode()) {
    const d = fixtureStore()
    const c = d.cargo_items.find((x) => x.id === id && x.added_by_loader)
    if (!c) throw new AppError('BAD_ITEMS')
    const next = guardCargo(
      d,
      {
        ...c,
        label: item.label,
        length_cm: item.lengthCm,
        width_cm: item.widthCm,
        height_cm: item.heightCm,
        weight_kg: item.weightKg,
        quantity: item.quantity,
        drop_stop_id: item.dropStopId,
        fragile: item.fragile,
        upright_only: item.uprightOnly,
        stackable: item.stackable,
      },
      { old: c, actor: 'loader' },
    )
    Object.assign(c, next)
    return fixtureDelay(undefined)
  }
  const { data, error } = await getSupabase().rpc('loader_update_cargo', {
    p_token: token,
    p_id: id,
    p_item: item as never,
  })
  if (error) throw toAppError(error)
  throwIfDataError(data)
}

/** Remove one item the loader added (loader_delete_cargo). */
export async function deleteLoaderItem(token: string, id: string): Promise<void> {
  if (isFixtureMode()) {
    const d = fixtureStore()
    const c = d.cargo_items.find((x) => x.id === id && x.added_by_loader)
    if (c) logChange(d, 'delete', c, c, 'loader')
    d.cargo_items = d.cargo_items.filter((x) => !(x.id === id && x.added_by_loader))
    return fixtureDelay(undefined)
  }
  const { data, error } = await getSupabase().rpc('loader_delete_cargo', { p_token: token, p_id: id })
  if (error) throw toAppError(error)
  throwIfDataError(data)
}
