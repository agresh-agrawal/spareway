// Home widget "Money this week": earned in the last 7 days, of which from extra loads, trips done.
import { Link } from 'react-router'
import { Coins, TrendingUp } from 'lucide-react'
import { Badge, Card, CardHeader } from '@/components/common'
import { formatInr } from '@/lib/format'
import { useLang } from '@/lib/i18n'
import { usePeriod, useTripsDone } from '../hooks'

export function ThisWeekWidget() {
  const { t } = useLang('analytics')
  const p = usePeriod(7)
  const done = useTripsDone(7)
  if (!p.totals || p.totals.days.length === 0) return null
  const tot = p.totals
  return (
    <Card>
      <CardHeader icon={Coins} title={t('widget.title')} action={tot.sample ? <Badge kind="sample" /> : undefined} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-label text-ink-2">{t('widget.earned')}</div>
          <div className="text-[28px] leading-9 font-semibold text-ok tabular">{formatInr(tot.earnedInr)}</div>
          <p className="text-ink-2 tabular">
            {t('widget.extra', { inr: formatInr(tot.extraInr) })}
            {done.data !== undefined && <> · {t('widget.trips', { count: done.data })}</>}
          </p>
        </div>
        <Link
          to="/earnings"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-control border border-line-strong bg-surface-2 px-4 text-button font-semibold hover:bg-surface-3"
        >
          <TrendingUp size={20} aria-hidden />
          {t('widget.see')}
        </Link>
      </div>
    </Card>
  )
}
