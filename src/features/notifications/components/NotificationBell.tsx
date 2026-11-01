// The bell in the top bar: number of unread notifications; tap → the notification bar (newest first, unread
// marked, tap one to open its trip / loads). Major ones also arrive by email (Settings → Email me).
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { AlertTriangle, Bell, CheckCheck, Info, Mail } from 'lucide-react'
import { EmptyState, IconButton, PlainButton, Sheet, SkeletonList } from '@/components/common'
import { useLang } from '@/lib/i18n'
import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/cn'
import { useMarkAllRead, useMarkRead, useNotices } from '../hooks'
import type { Notice } from '../api'

export function NotificationBell() {
  const { t, tm, lang } = useLang('notifications')
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const q = useNotices()
  const read = useMarkRead()
  const readAll = useMarkAllRead()
  const list = q.data ?? []
  const unread = list.filter((n) => !n.read_at).length

  const openOne = (n: Notice) => {
    if (!n.read_at) read.mutate(n.id)
    setOpen(false)
    if (n.link) nav(n.link)
  }

  return (
    <>
      <IconButton icon={Bell} label={t('bell', { count: unread })} badge={unread} onClick={() => setOpen(true)} />
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={t('title')}
        description={unread > 0 ? t('unread', { count: unread }) : t('allRead')}
        footer={
          unread > 0 ? (
            <PlainButton icon={CheckCheck} onClick={() => readAll.mutate()} disabled={readAll.isPending} className="w-full">
              {t('markAll')}
            </PlainButton>
          ) : undefined
        }
      >
        {q.isLoading ? (
          <SkeletonList rows={4} />
        ) : list.length === 0 ? (
          <EmptyState icon={Bell} text={t('empty')} />
        ) : (
          <ul className="flex flex-col gap-2">
            {list.map((n) => {
              const Icon = n.severity === 'info' ? Info : AlertTriangle
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => openOne(n)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-tile border p-3 text-left transition-colors hover:bg-surface-3',
                      n.read_at ? 'border-line bg-surface' : 'border-accent bg-accent-soft',
                    )}
                  >
                    <Icon
                      size={20}
                      className={cn('mt-0.5 shrink-0', n.severity === 'critical' ? 'text-crit' : n.severity === 'warning' ? 'text-warn' : 'text-ink-2')}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className={cn('block', !n.read_at && 'font-semibold')}>
                        {tm(n.kind, n.meta as Record<string, unknown>, n.title)}
                      </span>
                      <span className="mt-0.5 flex items-center gap-2 text-label text-ink-3">
                        {formatRelative(n.created_at, lang)}
                        {n.major && (
                          <span className="inline-flex items-center gap-1" title={t('emailed')}>
                            <Mail size={13} aria-hidden />
                            {t('major')}
                          </span>
                        )}
                        {n.is_sample && <span>· {t('sample')}</span>}
                      </span>
                    </span>
                    {!n.read_at && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-accent" aria-label={t('new')} />}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Sheet>
    </>
  )
}
