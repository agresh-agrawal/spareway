// Owner notifications during a trip: a toast (and a phone notification when the app is in the background and
// the owner allowed it) when a driver reports a challan / cost or a delivery, or a loader reports a problem.
import { useEffect } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/app/auth/AuthProvider'
import { getSupabase } from '@/lib/supabase'
import { isFixtureMode } from '@/lib/fixtures'
import { tm } from '@/lib/i18n'
import type { Tables } from '@/types/database'

export function ReportNotifier() {
  const { user } = useAuth()
  useEffect(() => {
    if (!user || isFixtureMode()) return
    const sb = getSupabase()
    const channel = sb
      .channel(`notify:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts' }, (payload) => {
        const a = payload.new as Tables<'alerts'>
        const text = tm(a.kind, a.meta as Record<string, unknown>, a.message)
        if (a.severity === 'info') toast(text)
        else toast.warning(text)
        try {
          if (document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification('Spareway', { body: text, tag: a.id })
        } catch {
          /* notifications not available */
        }
      })
      .subscribe()
    return () => {
      void sb.removeChannel(channel)
    }
  }, [user])
  return null
}
