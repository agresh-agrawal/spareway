import { useMemo, useState } from 'react'
import { Info, MessageCircle, Send } from 'lucide-react'
import { Card, CardHeader } from '@/components/common'
import i18n from '@/i18n/setup'
import { useLang } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import type { Lang } from '@/types/domain'
import type { RouteBasics } from '../api'
import type { PlannedRoute } from '../hooks'
import { driverMessage, whatsappLink } from '../lib/journey'

/** Driver message preview (Hindi by default), language switch, lime "Send on WhatsApp". */
export function DriverMessage({ route, basics }: { route: PlannedRoute; basics: RouteBasics }) {
  const { t } = useLang('routes')
  const [msgLang, setMsgLang] = useState<Lang>('hi')
  const text = useMemo(() => {
    const ft = i18n.getFixedT(msgLang, 'routes') as unknown as (k: string, v?: Record<string, unknown>) => string
    return driverMessage(
      {
        code: basics.trip.code,
        regNo: basics.truck.reg_no,
        driverName: basics.truck.driver_name ?? '',
        variantLabel: ft(`variant.${route.variant}`),
        distanceKm: route.distanceKm,
        tollsInr: route.cost.tollsInr,
        tollCount: route.cost.tollCount,
        plan: route.plan,
        stops: basics.stops,
      },
      ft,
      msgLang,
    )
  }, [msgLang, route, basics])
  const phone = basics.truck.driver_phone
  return (
    <Card>
      <CardHeader icon={MessageCircle} title={t('driver.title')} />
      <div role="group" aria-label={t('driver.language')} className="mb-3 flex gap-2">
        {(['hi', 'en'] as Lang[]).map((l) => (
          <button
            key={l}
            type="button"
            aria-pressed={msgLang === l}
            onClick={() => setMsgLang(l)}
            className={cn(
              'h-10 rounded-full border px-4 font-semibold transition-colors duration-200',
              msgLang === l ? 'border-accent bg-accent-soft text-ink' : 'border-line-strong bg-surface-2 text-ink-2 hover:bg-surface-3',
            )}
          >
            {l === 'hi' ? t('driver.hindi') : t('driver.english')}
          </button>
        ))}
      </div>
      <pre lang={msgLang} className="max-h-80 overflow-auto rounded-tile border border-line bg-surface-2 p-3 font-sans text-[15px] leading-6 whitespace-pre-wrap">
        {text}
      </pre>
      {!phone && (
        <p className="mt-2 flex items-start gap-2 text-label text-ink-2">
          <Info size={16} className="mt-0.5 shrink-0" aria-hidden />
          {t('driver.noPhone')}
        </p>
      )}
      <a
        href={whatsappLink(phone, text)}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-control bg-accent px-5 text-button font-semibold text-accent-ink hover:brightness-95"
      >
        <Send size={20} aria-hidden />
        {t('driver.send')}
      </a>
    </Card>
  )
}
