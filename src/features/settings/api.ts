import { getSupabase } from '@/lib/supabase'
import { throwIfDataError, toAppError } from '@/lib/errors'
import type { SettingsValues } from './schemas'
import { fixtureDelay, fixtureStore, isFixtureMode, resetFixtureStore } from '@/lib/fixtures'

export async function saveSettings(ids: { userId: string; companyId: string }, v: SettingsValues): Promise<void> {
  const { fullName, companyName, city, phone, ...costs } = v
  if (isFixtureMode()) {
    const d = fixtureStore()
    d.profile.full_name = fullName
    Object.assign(d.company, { name: companyName, city, phone })
    Object.assign(d.settings, costs)
    return fixtureDelay(undefined)
  }
  const sb = getSupabase()
  const [p, c, s] = await Promise.all([
    sb.from('profiles').update({ full_name: fullName }).eq('id', ids.userId),
    sb.from('companies').update({ name: companyName, city, phone }).eq('id', ids.companyId),
    sb.from('company_settings').update(costs).eq('company_id', ids.companyId),
  ])
  for (const r of [p, c, s]) if (r.error) throw toAppError(r.error)
}

/** Sample data is only for the owner's own and the QA test accounts (Pre-Phase 4). */
export async function canUseSampleData(): Promise<boolean> {
  if (isFixtureMode()) return fixtureDelay(true)
  const { data, error } = await getSupabase().rpc('sample_data_allowed')
  if (error) throw toAppError(error)
  return Boolean(data)
}

export async function resetSampleData(): Promise<void> {
  if (isFixtureMode()) {
    resetFixtureStore()
    return fixtureDelay(undefined)
  }
  const { error } = await getSupabase().rpc('reset_sample_data')
  if (error) throw toAppError(error)
}

/** Delete the signed-in account (and the company when nobody else is in it). `confirm` must be DELETE. */
export async function deleteMyAccount(confirm: string): Promise<void> {
  if (isFixtureMode()) {
    if (confirm !== 'DELETE') throw toAppError({ message: 'BAD_ITEMS' })
    return fixtureDelay(undefined)
  }
  const { data, error } = await getSupabase().rpc('delete_my_account', { p_confirm: confirm })
  if (error) throw toAppError(error)
  throwIfDataError(data)
}
