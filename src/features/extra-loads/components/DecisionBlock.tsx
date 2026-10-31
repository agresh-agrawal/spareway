// Owner addition: decision first, then PASS / FAIL for Payload · Space · Delivery order, then the money
// (offer, extra km, running cost, tolls, handling, waiting, total, expected extra earnings) with Estimated badges.
import { useState } from 'react'
import { ChevronDown, CircleCheck, CircleHelp, CircleX, Info } from 'lucide-react'
import { Badge, StatusChip, type Tone } from '@/components/common'
import { formatInr, formatKm, formatWeight } from '@/lib/format'
import { useLang } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import type { CheckState, Decision, Evaluation } from '../lib/evaluate'

const DECISION_TONE: Record<Decision, Tone> = { ACCEPT: 'ok', REJECT: 'crit', NOT_PROFITABLE: 'warn', NEEDS_REVIEW: 'info' }
const CHECK_ICON = { PASS: CircleCheck, FAIL: CircleX, REVIEW: CircleHelp }
const CHECK_CLASS: Record<CheckState, string> = { PASS: 'text-ok', FAIL: 'text-crit', REVIEW: 'text-info' }

type T = (key: string, values?: Record<string, unknown>) => string

/** Plain line for why it isn't ACCEPT (or '' when it is). */
export function evaluationReason(ev: Evaluation, t: T): string {
  if (!ev.reason) return ''
  if (ev.decision === 'NEEDS_REVIEW') return t(`review.${ev.reason}`)
  if (ev.reason === 'TOO_LARGE') return t('rejectReason.TOO_LARGE')
  return t(`reason.${ev.reason}`, {
    km: Math.round(ev.offKm),
    kg: formatWeight(ev.kg),
    left: formatWeight(Math.max(0, ev.remainingKg)),
    net: formatInr(ev.earningsInr),
    need: formatInr(ev.minViableInr),
  })
}

export function DecisionChip({ decision }: { decision: Decision }) {
  const { t } = useLang('extra-loads')
  return <StatusChip tone={DECISION_TONE[decision]}>{t(`decision.${decision}`)}</StatusChip>
}

export function ChecksRow({ ev }: { ev: Evaluation }) {
  const { t } = useLang('extra-loads')
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-label">
      {(['payload', 'space', 'order'] as const).map((k) => {
        const s = ev.checks[k]
        const Icon = CHECK_ICON[s]
        return (
          <li key={k} className={cn('inline-flex items-center gap-1 font-medium', CHECK_CLASS[s])}>
            <Icon size={16} aria-hidden />
            <span className="text-ink">{t(`checks.${k}`)}</span>
            <span>{t(`checks.${s}`)}</span>
          </li>
        )
      })}
    </ul>
  )
}

export function MoneyDetails({ ev, offerInr, open: openInitially = false }: { ev: Evaluation; offerInr: number; open?: boolean }) {
  const { t } = useLang('extra-loads')
  const [open, setOpen] = useState(openInitially)
  const rows: [string, string, boolean?][] = [
    [t('money.offer'), formatInr(offerInr)],
    [t('money.extraKm'), formatKm(ev.extraKm), true],
    [t('money.operating'), formatInr(ev.costs.operatingInr), true],
    [t('money.tolls'), t('money.tollsUnknown')],
    [t('money.handling'), formatInr(ev.costs.handlingInr)],
    [t('money.waiting'), formatInr(ev.costs.waitingInr)],
    [t('money.total'), formatInr(ev.costs.totalInr), true],
  ]
  return (
    <div>
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="inline-flex min-h-10 items-center gap-1 font-semibold text-ink-2 hover:text-ink">
        {open ? t('money.less') : t('money.more')}
        <ChevronDown size={18} aria-hidden className={cn('transition-transform duration-200', open && 'rotate-180')} />
      </button>
      {open && (
        <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 rounded-tile border border-line bg-surface-2 p-3 tabular">
          {rows.map(([label, value, estimated]) => (
            <div key={label} className="contents">
              <dt className="flex items-center gap-1.5 text-ink-2">
                {label}
                {estimated && <Badge kind="estimated" />}
              </dt>
              <dd className="text-right">{value}</dd>
            </div>
          ))}
          <dt className="font-semibold">{t('money.earnings')}</dt>
          <dd className={cn('text-right font-semibold', ev.earningsInr >= 0 ? 'text-ok' : 'text-crit')}>
            {ev.earningsInr >= 0 ? '+' : ''}
            {formatInr(ev.earningsInr)}
          </dd>
        </dl>
      )}
    </div>
  )
}

export function SafetyNote() {
  const { t } = useLang('extra-loads')
  return (
    <p className="flex items-start gap-1.5 text-label text-ink-2">
      <Info size={16} className="mt-0.5 shrink-0" aria-hidden />
      {t('safety')}
    </p>
  )
}
