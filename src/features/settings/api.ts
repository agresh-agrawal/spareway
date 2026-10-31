import { getSupabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
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

export async function resetSampleData(): Promise<void> {
  if (isFixtureMode()) {
    resetFixtureStore()
    return fixtureDelay(undefined)
  }
  const { error } = await getSupabase().rpc('reset_sample_data')
  if (error) throw toAppError(error)
}
