// Settings: "Email me major changes" — loader / driver problems, challans, trips finished or cancelled, new loads
// from providers, offer answers. One email every 10 minutes at most (notify-email Edge Function).
import { Mail } from 'lucide-react'
import { Card, CardHeader, Skeleton, SwitchField } from '@/components/common'
import { useAuth } from '@/app/auth/AuthProvider'
import { useLang } from '@/lib/i18n'
import { useEmailNotify, useSetEmailNotify } from '../hooks'

export function EmailSection() {
  const { t } = useLang('notifications')
  const { user } = useAuth()
  const q = useEmailNotify()
  const set = useSetEmailNotify()
  return (
    <Card>
      <CardHeader icon={Mail} title={t('email.title')} />
      <p className="mb-4 text-ink-2">{t('email.text', { email: user?.email ?? '' })}</p>
      {q.isLoading ? (
        <Skeleton className="h-12" />
      ) : (
        <SwitchField
          label={t('email.switch')}
          checked={set.isPending ? Boolean(set.variables) : (q.data ?? true)}
          onCheckedChange={(c) => set.mutate(c)}
        />
      )}
    </Card>
  )
}
