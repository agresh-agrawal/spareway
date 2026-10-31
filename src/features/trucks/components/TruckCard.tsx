import { Link } from 'react-router'
import { Phone, Route as RouteIcon } from 'lucide-react'
import { TruckStatusChip } from '@/components/common'
import { useLang } from '@/lib/i18n'
import { formatFt, formatWeight } from '@/lib/format'
import type { Truck } from '../api'

/** Number + status, "32 ft · 15 t", driver + call, current trip chip — max 2 chips (Design System 7.4). */
export function TruckCard({ truck, trip }: { truck: Truck; trip?: { id: string; code: string } }) {
  const { t, td } = useLang('trucks')
  const length = formatFt(truck.internal_length_cm).replace('.0 ft', ' ft')
  return (
    <div className="relative rounded-tile border border-line bg-surface-2 p-4 transition-colors duration-200 hover:bg-surface-3">
      <div className="flex items-start justify-between gap-3">
        <Link to={`/trucks/${truck.id}`} className="min-w-0 after:absolute after:inset-0 after:content-['']">
          <div className="truncate text-[18px] leading-6 font-semibold">{truck.reg_no}</div>
          <div className="mt-0.5 text-ink-2 tabular">
            {t('card.size', { length, payload: formatWeight(truck.payload_kg) })}
          </div>
        </Link>
        <TruckStatusChip status={truck.status} />
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-ink-2">{truck.driver_name ? td(truck.driver_name) : t('card.noDriver')}</span>
        {truck.driver_phone && (
          <a
            href={`tel:${truck.driver_phone.replace(/\s+/g, '')}`}
            aria-label={t('card.callDriver', { name: td(truck.driver_name) })}
            className="relative z-10 inline-flex h-12 shrink-0 items-center gap-1.5 rounded-control border border-line-strong bg-surface px-3 font-semibold hover:bg-surface-3"
          >
            <Phone size={18} aria-hidden />
            {t('common:actions.call')}
          </a>
        )}
      </div>
      {trip && (
        <Link
          to={`/trips/${trip.id}`}
          className="relative z-10 mt-2 inline-flex h-8 items-center gap-1.5 rounded-full bg-accent-soft px-3 text-label font-semibold text-accent"
        >
          <RouteIcon size={15} aria-hidden />
          {t('card.trip', { code: trip.code })}
        </Link>
      )}
    </div>
  )
}
