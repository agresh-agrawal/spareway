import { useState } from 'react'
import { Bell } from 'lucide-react'
import { Card, CardHeader, MainButton } from '@/components/common'
import { useLang } from '@/lib/i18n'

/** Settings: allow phone notifications for driver and loader reports. */
export function NotifySection() {
  const { t } = useLang('challan')
  const supported = typeof window !== 'undefined' && 'Notification' in window
  const [perm, setPerm] = useState<string>(() => (supported ? Notification.permission : 'denied'))
  return (
    <Card>
      <CardHeader icon={Bell} title={t('notify.title')} />
      <p className="mb-4 text-ink-2">{t('notify.text')}</p>
      {!supported ? (
        <p className="text-ink-2">{t('notify.unsupported')}</p>
      ) : perm === 'granted' ? (
        <p className="font-semibold text-ok">{t('notify.on')}</p>
      ) : perm === 'denied' ? (
        <p className="text-ink-2">{t('notify.blocked')}</p>
      ) : (
        <MainButton icon={Bell} onClick={() => void Notification.requestPermission().then(setPerm)}>
          {t('notify.turnOn')}
        </MainButton>
      )}
    </Card>
  )
}
