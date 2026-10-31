// Home: "Find extra loads" quick button + "Extra earnings available" widget for the next planned trip.
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Coins, PackageSearch } from 'lucide-react'
import { Badge, Card, CardHeader, QuickAction } from '@/components/common'
import { formatInr } from '@/lib/format'
import { useLang } from '@/lib/i18n'
import { queryKeys } from '@/lib/queryKeys'
import { fetchStepData } from '../api'
import { usePlannableTrips, tripLine } from '../hooks'
import { evaluateCandidates } from '../lib/candidates'

function useNextTrip() {
  const trips = usePlannableTrips()
  return trips.data?.find((x) => x.stops.length >= 2)?.trip ?? null
}

export function FindExtraAction() {
  const { t } = useLang('extra-loads')
  const trip = useNextTrip()
  if (!trip) return null
  return <QuickAction to={`/trips/${trip.id}?step=extra-loads`} icon={PackageSearch} label={t('findExtra')} />
}

/** Best profit on the next planned trip (no space check here — the step does that). */
export function ExtraEarningsWidget() {
  const { t, td } = useLang('extra-loads')
  const trip = useNextTrip()
  const data = useQuery({ queryKey: trip ? queryKeys.tripExtra(trip.id) : ['extra', 'none'], queryFn: () => fetchStepData(trip!.id), enabled: Boolean(trip) })
  if (!trip || !data.data) return null
  const d = data.data
  const { line, approximate } = tripLine(d)
  const booked = d.cargo.reduce((a, c) => a + Number(c.weight_kg) * Number(c.quantity), 0)
  const rec = evaluateCandidates({
    listings: d.listings,
    line,
    approximate,
    stops: d.stops,
    settings: d.settings,
    truck: d.truck,
    remainingPayloadKg: Number(d.truck.payload_kg) - booked,
  }).filter((c) => c.recommended)
  const sample = rec.some((c) => c.listing.is_sample)
  return (
    <Card>
      <CardHeader
        icon={Coins}
        title={t('widget.title')}
        action={<span className="flex gap-1.5">{sample && <Badge kind="sample" />}<Badge kind="estimated" /></span>}
      />
      {rec.length === 0 ? (
        <p className="text-ink-2">{t('widget.none')}</p>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p>
            <span className="text-[28px] leading-9 font-semibold text-ok tabular">{formatInr(rec[0].netBenefitInr)}</span>
            <span className="block text-ink-2">{t('widget.text', { profit: formatInr(rec[0].netBenefitInr), code: d.trip.code, count: rec.length })}</span>
            <span className="block text-label text-ink-2">{td(rec[0].listing.goods_type)} · {td(rec[0].listing.pickup_name)} → {td(rec[0].listing.drop_name)}</span>
          </p>
          <Link
            to={`/trips/${trip.id}?step=extra-loads`}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-control border border-line-strong bg-surface-2 px-4 text-button font-semibold hover:bg-surface-3"
          >
            <PackageSearch size={20} aria-hidden />
            {t('widget.see')}
          </Link>
        </div>
      )}
    </Card>
  )
}
