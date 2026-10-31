import { getSupabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import { fixtureDelay, fixtureStore, FIXTURE_COMPANY_ID, isFixtureMode } from '@/lib/fixtures'
import type { Tables } from '@/types/database'
import type { CargoValues } from './schemas'

export type CargoItem = Tables<'cargo_items'>

export async function listCargo(tripId: string): Promise<CargoItem[]> {
  if (isFixtureMode())
    return fixtureDelay(fixtureStore().cargo_items.filter((c) => c.trip_id === tripId).sort((a, b) => a.created_at.localeCompare(b.created_at)))
  const { data, error } = await getSupabase().from('cargo_items').select('*').eq('trip_id', tripId).order('created_at')
  if (error) throw toAppError(error)
  return data
}

export async function saveCargo(tripId: string, v: CargoValues, id?: string): Promise<CargoItem> {
  if (isFixtureMode()) {
    const d = fixtureStore()
    if (id) {
      const c = d.cargo_items.find((x) => x.id === id)!
      Object.assign(c, v)
      return fixtureDelay(c)
    }
    const c: CargoItem = {
      ...v,
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
    }
    d.cargo_items.push(c)
    return fixtureDelay(c)
  }
  const sb = getSupabase()
  const q = id
    ? sb.from('cargo_items').update(v).eq('id', id).select().single()
    : sb.from('cargo_items').insert({ ...v, trip_id: tripId, source: 'manual' }).select().single()
  const { data, error } = await q
  if (error) throw toAppError(error)
  return data
}

export async function deleteCargo(id: string): Promise<void> {
  if (isFixtureMode()) {
    const d = fixtureStore()
    d.cargo_items = d.cargo_items.filter((c) => c.id !== id)
    return fixtureDelay(undefined)
  }
  const { error } = await getSupabase().from('cargo_items').delete().eq('id', id)
  if (error) throw toAppError(error)
}
