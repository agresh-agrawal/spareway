import { Calculator } from 'lucide-react'
import { useAuth } from '@/app/auth/AuthProvider'
import { useLang } from '@/lib/i18n'
import { formatInr, formatNumber } from '@/lib/format'
import { truckGist, type GistInput } from '../lib/gist'

/** Live summary under the truck form: what fits, when weight runs out first, what 500 km costs. */
export function TruckGistCard(props: Omit<GistInput, 'dieselInrPerL'>) {
  const { t } = useLang('trucks')
  const { settings } = useAuth()
  const g = truckGist({ ...props, dieselInrPerL: Number(settings?.diesel_price_inr_per_l ?? 90) })
  if (!g) return null
  const rows: [string, string][] = [
    [t('gist.space'), t('gist.spaceValue', { m3: g.volumeM3, cft: formatNumber(g.volumeCft), sqft: formatNumber(g.floorSqft) })],
    [t('gist.fits'), t('gist.fitsValue', { pallets: g.pallets, cartons: formatNumber(g.cartons) })],
  ]
  if (g.densityKgPerM3 > 0) rows.push([t('gist.weightFirst'), t('gist.weightFirstValue', { kg: formatNumber(g.densityKgPerM3) })])
  if (g.cost500Inr > 0) rows.push([t('gist.cost500'), formatInr(g.cost500Inr)])
  if (g.diesel500L > 0) rows.push([t('gist.diesel500'), t('gist.diesel500Value', { l: g.diesel500L, inr: formatInr(g.diesel500Inr) })])
  if (g.perTonneKmInr !== null) rows.push([t('gist.perTonneKm'), `₹${g.perTonneKmInr}`])
  return (
    <section className="rounded-tile border border-line bg-surface-2 p-4" aria-live="polite">
      <h3 className="mb-3 flex items-center gap-2 font-semibold">
        <Calculator size={18} className="text-accent" aria-hidden />
        {t('gist.title')}
      </h3>
      <dl className="grid gap-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex flex-wrap items-baseline justify-between gap-x-4">
            <dt className="text-ink-2">{k}</dt>
            <dd className="font-semibold tabular">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
