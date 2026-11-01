import { CircleCheck, MoveHorizontal, Scale, TriangleAlert } from 'lucide-react'
import { Bar, Card } from '@/components/common'
import { formatFt, formatWeight } from '@/lib/format'
import { useLang } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import type { PackContainer, PackResult } from '@/types/domain'
import { freeFloorCm } from '../lib/plan'

function Tile({ icon: Icon, value, label, tone }: { icon: typeof Scale; value: string; label?: string; tone?: 'ok' | 'warn' }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-tile border border-line bg-surface-2 p-3 sm:p-4">
      <Icon size={24} aria-hidden className={cn(tone === 'ok' ? 'text-ok' : tone === 'warn' ? 'text-warn' : 'text-ink-2')} />
      <span
        className={cn(
          'font-semibold tabular',
          label ? 'text-[20px] leading-7 sm:text-[24px]' : 'text-[16px] leading-6 sm:text-[18px]',
          tone === 'ok' && 'text-ok',
          tone === 'warn' && 'text-warn',
        )}
      >
        {value}
      </span>
      {label && <span className="text-label text-ink-2">{label}</span>}
    </div>
  )
}

/** "Space used" + "Weight" bars, then Free floor · Weight left · Balance (3 numbers max per card). */
export function PlanSummary({ container, result }: { container: PackContainer; result: PackResult }) {
  const { t } = useLang('load-planner')
  const m = result.metrics
  const balanceWarnings = result.warnings.filter((w) => w.code !== 'HEAVY_HIGH')
  const balanced = balanceWarnings.length === 0
  return (
    <div className="flex flex-col gap-3">
      <Card className="flex flex-col gap-4">
        <h2 className="sr-only">{t('summary.cardTitle')}</h2>
        <Bar label={t('summary.spaceUsed')} pct={m.volumeUsedPct} />
        <Bar label={t('summary.weight')} pct={m.weightUsedPct} />
      </Card>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Tile icon={MoveHorizontal} value={formatFt(freeFloorCm(container, m))} label={t('summary.freeFloor')} />
        <Tile icon={Scale} value={formatWeight(Math.max(0, m.remainingPayloadKg))} label={t('summary.weightLeft')} />
        <Tile
          icon={balanced ? CircleCheck : TriangleAlert}
          value={balanced ? t('summary.balanceOk') : t('summary.balanceCheck')}
          tone={balanced ? 'ok' : 'warn'}
        />
      </div>
      {result.warnings.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label={t('summary.balanceCheck')}>
          {result.warnings.map((w) => (
            <li key={w.code} className="flex items-start gap-2 rounded-tile border border-warn/30 bg-warn/[0.06] p-3 text-ink">
              <TriangleAlert size={20} className="mt-0.5 shrink-0 text-warn" aria-hidden />
              {t(`warnings.${w.code}`)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
