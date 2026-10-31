import { getSupabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import type { Company, CompanySettings, Lang, Profile } from '@/types/domain'
import { fixtureStore, isFixtureMode } from '@/lib/fixtures'

export interface Me {
  profile: Profile
  company: Company
  settings: CompanySettings
}

/** profile + company + settings of the signed-in owner. Missing profile → throws. */
export async function fetchMe(userId: string): Promise<Me> {
  const sb = getSupabase()
  const { data: profile, error: pErr } = await sb.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (pErr) throw toAppError(pErr)
  if (!profile) throw toAppError({ message: 'NOT_SIGNED_IN: profile missing' })
  const [{ data: company, error: cErr }, { data: settings, error: sErr }] = await Promise.all([
    sb.from('companies').select('*').eq('id', profile.company_id).single(),
    sb.from('company_settings').select('*').eq('company_id', profile.company_id).single(),
  ])
  if (cErr) throw toAppError(cErr)
  if (sErr) throw toAppError(sErr)
  return { profile, company, settings }
}

/** First login: create the demo fleet once (no-op when already seeded). */
export async function seedSampleData(): Promise<boolean> {
  const { data, error } = await getSupabase().rpc('seed_sample_data')
  if (error) throw toAppError(error)
  return Boolean((data as { seeded?: boolean } | null)?.seeded)
}

export async function savePreferredLang(userId: string, lang: Lang): Promise<void> {
  if (isFixtureMode()) {
    fixtureStore().profile.preferred_lang = lang
    return
  }
  const { error } = await getSupabase().from('profiles').update({ preferred_lang: lang }).eq('id', userId)
  if (error) throw toAppError(error)
}
