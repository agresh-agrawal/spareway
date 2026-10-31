/// <reference types="vite-plugin-pwa/client" />
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { WifiOff } from 'lucide-react'
import { toast } from 'sonner'
import { useLang } from '@/lib/i18n'
import { getSupabase } from '@/lib/supabase'
import { isFixtureMode } from '@/lib/fixtures'
import { useOnline } from '../lib/online'
import { clearSavedData } from '../lib/persist'
import { clearQueue, onQueueChange, readQueue, replayQueue } from '../lib/queue'

/**
 * Mounted once for every page (shell and loader page): amber "No internet" bar, sends queued changes when the internet is back,
 * forgets saved data on sign-out, and shows the "new version" toast from the service worker.
 */
export function OfflineLayer() {
  const { t } = useLang('offline')
  const online = useOnline()
  const qc = useQueryClient()
  const [waiting, setWaiting] = useState(() => readQueue().length)

  useEffect(() => onQueueChange(() => setWaiting(readQueue().length)), [])

  useEffect(() => {
    if (!online || readQueue().length === 0) return
    void replayQueue().then((r) => {
      if (r.sent) {
        toast.success(t('synced', { count: r.sent }))
        void qc.invalidateQueries()
      }
      if (r.dropped.length) toast.error(t('dropped', { count: r.dropped.length }))
    })
  }, [online]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isFixtureMode()) return
    try {
      const { data } = getSupabase().auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') {
          clearSavedData()
          clearQueue()
        }
      })
      return () => data.subscription.unsubscribe()
    } catch {
      return // no Supabase settings (setup screen)
    }
  }, [])

  useEffect(() => {
    if (!import.meta.env.PROD) return // the service worker is off while developing
    let update: ((reload?: boolean) => Promise<void>) | undefined
    void import('virtual:pwa-register').then(({ registerSW }) => {
      update = registerSW({
        onNeedRefresh() {
          toast(t('update'), { duration: Infinity, action: { label: t('reload'), onClick: () => void update?.(true) } })
        },
      })
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (online) return null
  return (
    <div
      role="status"
      className="safe-bottom pointer-events-none fixed inset-x-0 bottom-[76px] z-[60] flex justify-center px-3 lg:bottom-4"
    >
      <p className="flex max-w-[560px] items-center gap-2 rounded-control bg-warn px-4 py-2.5 text-[15px] font-semibold text-black shadow-lg">
        <WifiOff size={18} className="shrink-0" aria-hidden />
        <span>
          {t('banner')}
          {waiting > 0 && ` · ${t('waiting', { count: waiting })}`}
        </span>
      </p>
    </div>
  )
}
