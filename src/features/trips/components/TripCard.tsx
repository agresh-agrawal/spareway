import { Link } from 'react-router'
import { CalendarClock } from 'lucide-react'
import { Bar, TripStatusChip } from '@/components/common'
import { TruckChip } from '@/features/trucks'
import { useLang } from '@/lib/i18n'
import { formatDateTime } from '@/lib/format'
import type { TripOverview } from '../api'

/** Space used: the active plan's number, else booked cargo volume ÷ truck volume. */
export function tripSpacePct(t: TripOverview): number {
  if (t.plan_volume_used_pct !== null && t.plan_volume_used_pct !== undefined) return Number(t.plan_volume_used_pct)
  const truckVol = Number(t.truck_volume_m3) || 0
  return truckVol > 0 ? (100 * (Number(t.cargo_volume_m3) || 0)) / truckVol : 0
}

/** "Manesar → Mumbai (Bhiwandi) · 3 drops", truck chip, departure, space used. */
export function TripCard({ trip }: { trip: TripOverview }) {
  const { t, td, lang } = useLang('trips')
  return (
    <div className="relative flex flex-col gap-3 rounded-tile border border-line bg-surface-2 p-4 transition-colors duration-200 hover:bg-surface-3">
      <div className="flex items-start justify-between gap-3">
        <Link to={`/trips/${trip.id}`} className="min-w-0 after:absolute after:inset-0 after:content-['']">
          <div className="text-label font-semibold text-ink-2">{trip.code}</div>
          <div className="mt-0.5 text-[17px] leading-6 font-semibold">
            {t('card.route', { from: td(trip.origin_name), to: td(trip.final_stop_name) })}
          </div>
          <div className="text-ink-2">{t('card.drops', { count: trip.stop_count ?? 0 })}</div>
        </Link>
        <TripStatusChip status={trip.status ?? 'planned'} />
      </div>
      <div className="relative z-10 flex flex-wrap items-center gap-2">
        {trip.reg_no && <TruckChip id={trip.truck_id} regNo={trip.reg_no} />}
        {trip.planned_departure && (
          <span className="inline-flex items-center gap-1.5 text-label text-ink-2">
            <CalendarClock size={16} aria-hidden />
            {t('card.departs', { when: formatDateTime(trip.planned_departure, lang) })}
          </span>
        )}
      </div>
      <Bar label={t('card.spaceUsed')} pct={tripSpacePct(trip)} />
    </div>
  )
}
