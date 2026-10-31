import { Check, CircleCheck, Eye, TriangleAlert } from 'lucide-react'
import { Badge, MainButton, PlainButton, StatusChip } from '@/components/common'
import { formatDuration, formatInr, formatKm } from '@/lib/format'
import { useLang } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import type { PlannedRoute } from '../hooks'
import { warningText } from '../lib/journey'

const MAX_WARNINGS = 2

/** One route: name + Best, km · time, total ₹ (hero), one cost line, breaks · tolls, warnings, Choose. */
export function RouteCard({
  route,
  viewed,
  chosen,
  lime,
  choosing,
  onView,
  onChoose,
}: {
  route: PlannedRoute
  viewed: boolean
  chosen: boolean
  /** the one lime button of the step */
  lime: boolean
  choosing: boolean
  onView: () => void
  onChoose: () => void
}) {
  const { t, lang } = useLang('routes')
  const { cost, plan } = route
  const breaks = plan.breakCount + plan.overnightCount
  const ChooseButton = lime ? MainButton : PlainButton
  // no-entry waits first (they change the plan), then late deliveries
  const warnings = [...plan.schedule.warnings].sort((a, b) => (a.code === b.code ? 0 : a.code === 'NO_ENTRY' ? -1 : 1))
  return (
    <article
      className={cn(
        'flex min-w-0 flex-col gap-3 rounded-card border bg-surface p-4 sm:p-5',
        viewed ? 'border-accent/60' : 'border-line',
      )}
      aria-label={t(`variant.${route.variant}`)}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-section-title font-semibold">{t(`variant.${route.variant}`)}</h3>
        {route.best && <StatusChip tone="ok">{t('card.best')}</StatusChip>}
        {chosen && <StatusChip tone="accent">{t('card.chosen')}</StatusChip>}
      </div>
      <div className="text-ink-2 tabular">{t('card.time', { km: formatKm(route.distanceKm), time: formatDuration(plan.totalMin, lang) })}</div>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[28px] leading-9 font-semibold tabular sm:text-big-number">{formatInr(cost.totalInr)}</span>
          <Badge kind="estimated" />
        </div>
        <div className="text-label text-ink-2">{t('card.total')}</div>
      </div>
      <p className="text-ink-2 tabular">
        {t('card.costLine', { fuel: formatInr(cost.fuelInr), tolls: formatInr(cost.tollsInr), driver: formatInr(cost.driverInr) })}
        {cost.waitingInr > 0 && <> · {t('card.waiting', { inr: formatInr(cost.waitingInr) })}</>}
      </p>
      <p className="text-ink-2 tabular">{t('card.counts', { breaks, count: cost.tollCount })}</p>
      {warnings.length > 0 && (
        <ul className="flex flex-col gap-2">
          {warnings.slice(0, MAX_WARNINGS).map((w, i) => (
            <li key={i} className="flex items-start gap-2 rounded-tile border border-warn/30 bg-warn/[0.06] p-2.5">
              <TriangleAlert size={18} className="mt-0.5 shrink-0 text-warn" aria-hidden />
              <span>{warningText(w, t, lang)}</span>
            </li>
          ))}
          {warnings.length > MAX_WARNINGS && (
            <li className="text-label text-ink-2">{t('card.moreWarnings', { count: warnings.length - MAX_WARNINGS })}</li>
          )}
        </ul>
      )}
      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        {!viewed && (
          <PlainButton icon={Eye} onClick={onView} className="flex-1">
            {t('card.show')}
          </PlainButton>
        )}
        {chosen ? (
          <span className="inline-flex h-12 flex-1 items-center justify-center gap-2 font-semibold text-ok">
            <CircleCheck size={20} aria-hidden />
            {t('card.chosen')}
          </span>
        ) : (
          <ChooseButton icon={Check} onClick={onChoose} loading={choosing} className="flex-1">
            {t('card.choose')}
          </ChooseButton>
        )}
      </div>
    </article>
  )
}
