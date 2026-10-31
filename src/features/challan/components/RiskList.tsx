import { AlertTriangle, Info, ShieldAlert } from 'lucide-react'
import { useLang } from '@/lib/i18n'
import { formatInr, formatWeight } from '@/lib/format'
import { cn } from '@/lib/cn'
import { HABITS, PAPERS, type ChallanRisk } from '../lib/risks'

const ICON = { critical: ShieldAlert, warning: AlertTriangle, info: Info }
const TONE = { critical: 'border-crit/40 bg-crit/[0.08] text-crit', warning: 'border-warn/40 bg-warn/[0.08]', info: 'border-line bg-surface-2' }

/** This trip's challan risks, worst first; "No challan risks found" when clear. */
export function RiskList({ risks, big }: { risks: ChallanRisk[]; big?: boolean }) {
  const { t, td } = useLang('challan')
  if (risks.length === 0) return <p className="rounded-tile border border-ok/40 bg-ok/[0.08] p-3 font-semibold text-ok">{t('risks.none')}</p>
  return (
    <ul className="flex flex-col gap-2">
      {risks.map((r, i) => {
        const Icon = ICON[r.level]
        const v = r.values
        const text =
          r.code === 'OVERLOAD'
            ? t('risks.OVERLOAD', { extra: formatWeight(Number(v.extraKg)), fine: formatInr(Number(v.fine)) })
            : r.code === 'NEAR_LIMIT'
              ? t('risks.NEAR_LIMIT', { pct: v.pct })
              : r.code === 'NO_ENTRY'
                ? t('risks.NO_ENTRY', { city: td(String(v.city)), h: Math.floor(Number(v.wait) / 60), m: Number(v.wait) % 60 })
                : t('risks.LATE', { stop: td(String(v.stop)) })
        return (
          <li key={i} className={cn('flex items-start gap-3 rounded-tile border p-3', TONE[r.level], big && 'text-[18px] leading-7')}>
            <Icon size={big ? 24 : 20} className="mt-0.5 shrink-0" aria-hidden />
            <span className="font-medium text-ink">{text}</span>
          </li>
        )
      })}
    </ul>
  )
}

/** Papers to carry and driving habits, each with the usual fine (central amounts; states can differ). */
export function FineGuide({ big }: { big?: boolean }) {
  const { t } = useLang('challan')
  const row = (id: string, fine: number, group: 'papers' | 'habits') => (
    <li key={id} className={cn('flex items-baseline justify-between gap-3 py-2', big && 'text-[18px]')}>
      <span>{t(`${group}.${id}`)}</span>
      <span className="shrink-0 font-semibold tabular">{t('guide.fine', { inr: formatInr(fine) })}</span>
    </li>
  )
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="font-semibold">{t('guide.papers')}</h3>
        <ul className="divide-y divide-line">{PAPERS.map((p) => row(p.id, p.fineInr, 'papers'))}</ul>
      </div>
      <div>
        <h3 className="font-semibold">{t('guide.habits')}</h3>
        <ul className="divide-y divide-line">{HABITS.map((p) => row(p.id, p.fineInr, 'habits'))}</ul>
      </div>
      <p className="text-label text-ink-2">{t('guide.note')}</p>
    </div>
  )
}
