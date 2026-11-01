import { getSupabase } from '@/lib/supabase'
import { AppError, throwIfDataError, toAppError } from '@/lib/errors'
import { fixtureDelay, fixtureStore, FIXTURE_COMPANY_ID, isFixtureMode } from '@/lib/fixtures'
import type { Tables } from '@/types/database'
import type { CargoValues } from './schemas'
import {
  assertNotLocked,
  fixtureWeighing,
  guardCargo,
  integrityDefaults,
  logChange,
} from './lib/fixtureGuard'

export type CargoItem = Tables<'cargo_items'>
export type CargoChange = Tables<'cargo_changes'>
export type Weighing = Tables<'trip_weighings'>

const BUCKET = 'cargo-images'

export async function listCargo(tripId: string): Promise<CargoItem[]> {
  if (isFixtureMode())
    return fixtureDelay(
      fixtureStore()
        .cargo_items.filter((c) => c.trip_id === tripId)
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    )
  const { data, error } = await getSupabase()
    .from('cargo_items')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at')
  if (error) throw toAppError(error)
  return data
}

export async function saveCargo(tripId: string, v: CargoValues, id?: string): Promise<CargoItem> {
  if (isFixtureMode()) {
    const d = fixtureStore()
    if (id) {
      const c = d.cargo_items.find((x) => x.id === id)
      if (!c) throw new AppError('BAD_ITEMS')
      Object.assign(c, guardCargo(d, { ...c, ...v }, { old: c, actor: 'owner' }))
      return fixtureDelay(c)
    }
    const c: CargoItem = guardCargo(
      d,
      {
        ...v,
        ...integrityDefaults,
        id: crypto.randomUUID(),
        company_id: FIXTURE_COMPANY_ID,
        trip_id: tripId,
        sku: '',
        max_top_load_kg: null,
        source: 'manual',
        added_by_loader: false,
        extra_load_id: null,
        image_path: null,
        confidence: null,
        created_at: new Date().toISOString(),
      },
      { actor: 'owner' },
    )
    d.cargo_items.push(c)
    return fixtureDelay(c)
  }
  const sb = getSupabase()
  const q = id
    ? sb.from('cargo_items').update(v).eq('id', id).select().single()
    : sb
        .from('cargo_items')
        .insert({ ...v, trip_id: tripId, source: 'manual' })
        .select()
        .single()
  const { data, error } = await q
  if (error) throw toAppError(error)
  return data
}

export async function deleteCargo(id: string): Promise<void> {
  if (isFixtureMode()) {
    const d = fixtureStore()
    const c = d.cargo_items.find((x) => x.id === id)
    if (c) {
      assertNotLocked(d, c.trip_id)
      logChange(d, 'delete', c, c, 'owner')
    }
    d.cargo_items = d.cargo_items.filter((x) => x.id !== id)
    return fixtureDelay(undefined)
  }
  const { error } = await getSupabase().from('cargo_items').delete().eq('id', id)
  if (error) throw toAppError(error)
}

/** Weight each of the company's earlier lines (other trips) — the "usually X kg" lookup and HISTORY_MISMATCH. */
export async function listPastWeights(tripId: string): Promise<{ label: string; weight_kg: number }[]> {
  if (isFixtureMode())
    return fixtureDelay(
      fixtureStore()
        .cargo_items.filter((c) => c.trip_id !== tripId)
        .map((c) => ({ label: c.label, weight_kg: Number(c.weight_kg) })),
    )
  const { data, error } = await getSupabase()
    .from('cargo_items')
    .select('label, weight_kg')
    .neq('trip_id', tripId)
    .order('created_at', { ascending: false })
    .limit(2000)
  if (error) throw toAppError(error)
  return data.map((r) => ({ label: r.label, weight_kg: Number(r.weight_kg) }))
}

/** Who changed what on this trip's cargo (append-only, newest first). */
export async function listCargoChanges(tripId: string): Promise<CargoChange[]> {
  if (isFixtureMode()) return fixtureDelay(fixtureStore().cargo_changes.filter((c) => c.trip_id === tripId))
  const { data, error } = await getSupabase()
    .from('cargo_changes')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw toAppError(error)
  return data
}

/** Owner marks a flagged line as checked, with a reason (confirm_cargo_check; any later edit clears it). */
export async function confirmCargoCheck(id: string, note: string): Promise<void> {
  if (isFixtureMode()) {
    const d = fixtureStore()
    const c = d.cargo_items.find((x) => x.id === id)
    if (!c || note.trim().length < 10) throw new AppError('BAD_ITEMS')
    assertNotLocked(d, c.trip_id)
    const old = { ...c }
    Object.assign(c, {
      integrity_note: note.trim().slice(0, 300),
      integrity_confirmed_at: new Date().toISOString(),
      integrity_confirmed_by: d.profile.id,
    })
    Object.assign(c, guardCargo(d, { ...c }, { old: c, actor: 'system', log: false }))
    logChange(d, 'update', old, c, 'owner')
    return fixtureDelay(undefined)
  }
  const { data, error } = await getSupabase().rpc('confirm_cargo_check', { p_id: id, p_note: note })
  if (error) throw toAppError(error)
  throwIfDataError(data)
}

/** Upload a proof photo / weighbridge slip to <company>/evidence/… (private bucket); returns its path. */
export async function uploadEvidence(file: Blob): Promise<string> {
  if (isFixtureMode()) return fixtureDelay(`${FIXTURE_COMPANY_ID}/evidence/${crypto.randomUUID()}.jpg`, 300)
  const sb = getSupabase()
  const { data: company, error: cErr } = await sb.rpc('current_company_id')
  if (cErr || !company) throw toAppError(cErr ?? { message: 'NOT_SIGNED_IN' })
  const path = `${company}/evidence/${crypto.randomUUID()}.jpg`
  const { error } = await sb.storage
    .from(BUCKET)
    .upload(path, file, { contentType: 'image/jpeg', upsert: false })
  if (error) throw toAppError(error)
  return path
}

/** Attach an uploaded proof to a line (a flagged line then counts as checked). */
export async function attachEvidence(id: string, path: string): Promise<void> {
  if (isFixtureMode()) {
    const d = fixtureStore()
    const c = d.cargo_items.find((x) => x.id === id)
    if (!c) throw new AppError('BAD_ITEMS')
    Object.assign(c, guardCargo(d, { ...c, evidence_path: path }, { old: c, actor: 'owner' }))
    return fixtureDelay(undefined)
  }
  const { error } = await getSupabase().from('cargo_items').update({ evidence_path: path }).eq('id', id)
  if (error) throw toAppError(error)
}

/** Short-lived link to look at a proof photo (none in fixture mode). */
export async function evidenceUrl(path: string): Promise<string | null> {
  if (isFixtureMode()) return null
  const { data, error } = await getSupabase().storage.from(BUCKET).createSignedUrl(path, 600)
  if (error) throw toAppError(error)
  return data.signedUrl
}

export async function listWeighings(tripId: string): Promise<Weighing[]> {
  if (isFixtureMode()) return fixtureDelay(fixtureStore().trip_weighings.filter((w) => w.trip_id === tripId))
  const { data, error } = await getSupabase()
    .from('trip_weighings')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false })
  if (error) throw toAppError(error)
  return data
}

export interface WeighingInput {
  grossKg: number
  tareKg: number | null
  slipPath: string
  lat: number | null
  lng: number | null
  accuracyM: number | null
}

/** Owner enters a weighbridge slip; net, declared, match and distance are worked out by the database. */
export async function addWeighing(tripId: string, w: WeighingInput): Promise<Weighing> {
  if (isFixtureMode())
    return fixtureDelay(fixtureWeighing(fixtureStore(), { tripId, ...w, enteredBy: 'owner' }))
  const { data, error } = await getSupabase()
    .from('trip_weighings')
    .insert({
      trip_id: tripId,
      gross_kg: w.grossKg,
      tare_kg: w.tareKg,
      slip_path: w.slipPath,
      lat: w.lat,
      lng: w.lng,
      accuracy_m: w.accuracyM,
    })
    .select()
    .single()
  if (error) throw toAppError(error)
  return data
}
