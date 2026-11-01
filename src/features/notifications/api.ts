// Notification bar: every major change (loader / driver / provider reports, trips started / finished) — filled by
// database triggers (prephase4code_notifications.sql). Major ones are also emailed by the notify-email function.
import { getSupabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import { fixtureDelay, fixtureStore, FIXTURE_USER_ID, isFixtureMode } from '@/lib/fixtures'
import type { Tables } from '@/types/database'

export type Notice = Tables<'notifications'>

const LIMIT = 40

export async function listNotices(): Promise<Notice[]> {
  if (isFixtureMode())
    return fixtureDelay(fixtureStore().notifications.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, LIMIT))
  const { data, error } = await getSupabase().from('notifications').select('*').order('created_at', { ascending: false }).limit(LIMIT)
  if (error) throw toAppError(error)
  return data
}

export async function markRead(id: string): Promise<void> {
  if (isFixtureMode()) {
    const n = fixtureStore().notifications.find((x) => x.id === id)
    if (n && !n.read_at) n.read_at = new Date().toISOString()
    return fixtureDelay(undefined)
  }
  const { error } = await getSupabase().from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).is('read_at', null)
  if (error) throw toAppError(error)
}

export async function markAllRead(): Promise<void> {
  if (isFixtureMode()) {
    const now = new Date().toISOString()
    for (const n of fixtureStore().notifications) n.read_at ??= now
    return fixtureDelay(undefined)
  }
  const { error } = await getSupabase().rpc('mark_notifications_read')
  if (error) throw toAppError(error)
}

export async function getEmailNotify(): Promise<boolean> {
  if (isFixtureMode()) return fixtureDelay(fixtureStore().profile.email_notify)
  const sb = getSupabase()
  const { data: u } = await sb.auth.getUser()
  const { data, error } = await sb.from('profiles').select('email_notify').eq('id', u.user?.id ?? '').maybeSingle()
  if (error) throw toAppError(error)
  return data?.email_notify ?? true
}

export async function setEmailNotify(on: boolean): Promise<void> {
  if (isFixtureMode()) {
    fixtureStore().profile.email_notify = on
    return fixtureDelay(undefined)
  }
  const sb = getSupabase()
  const { data: u } = await sb.auth.getUser()
  const { error } = await sb.from('profiles').update({ email_notify: on }).eq('id', u.user?.id ?? FIXTURE_USER_ID)
  if (error) throw toAppError(error)
}
