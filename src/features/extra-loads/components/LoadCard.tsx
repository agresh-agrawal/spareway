import { forwardRef } from 'react'
import { Eye, PackagePlus } from 'lucide-react'
import { Badge, MainButton, PlainButton } from '@/components/common'
import { formatCargoSize, formatDate, formatInr, formatWeight } from '@/lib/format'
import { useLang } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import type { Candidate } from '../lib/candidates'
import { takeText } from '../lib/text'
import { ChecksRow, DecisionChip, MoneyDetails } from './DecisionBlock'

/** Goods + from → to, size / weight, offer · cost, Profit big green, one plain reason, See in truck, Add to trip. */
export const LoadCard = forwardRef<HTMLElement, {
  c: Candidate
  lime: boolean
  selected: boolean
  adding: boolean
  disabled: boolean
  onSee: () => void
  onAdd: () => void
}>(function LoadCard({ c, lime, selected, adding, disabled, onSee, onAdd }, ref) {
  const { t, td, lang } = useLang('extra-loads')
  const l = c.listing
  const AddButton = lime ? MainButton : PlainButton
  return (
    <article
      ref={ref}
      aria-label={c.code}
      className={cn('flex min-w-0 flex-col gap-3 rounded-card border bg-surface p-4 sm:p-5', selected ? 'border-accent/60' : 'border-line')}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-2">
          <DecisionChip decision={c.decision} />
          <h3 className="text-section-title font-semibold">{td(l.goods_type)}</h3>
        </span>
        <span className="flex gap-1.5">
          {l.is_sample && <Badge kind="demo" />}
          {l.visibility === 'public' && <Badge kind="public" />}
          {c.approximate && <Badge kind="approximate" />}
        </span>
      </div>
      <div className="text-ink-2">
        {t('card.fromTo', { from: td(l.pickup_name), to: td(l.drop_name) })} · {c.code}
      </div>
      <div className="text-label text-ink-2 tabular">
        {t('card.size', { count: c.units, size: formatCargoSize(l.length_cm, l.width_cm, l.height_cm), kg: formatWeight(c.kg) })}
      </div>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <div>
          <div className="text-label text-ink-2">{t('card.profit')}</div>
          <div className="text-[28px] leading-9 font-semibold text-ok tabular sm:text-big-number">{formatInr(c.netBenefitInr)}</div>
        </div>
        <div className="text-ink-2 tabular">
          {t('card.offer')} {formatInr(l.offered_rate_inr)} · {t('card.cost')} {formatInr(c.cost.totalInr)}
        </div>
      </div>
      <ChecksRow ev={c.evaluation} />
      <p className="flex flex-wrap items-center gap-2">
        {takeText(c, t)} <Badge kind="estimated" />
      </p>
      <MoneyDetails ev={c.evaluation} offerInr={Number(l.offered_rate_inr)} />
      {l.deliver_by && <p className="text-label text-ink-2">{t('card.deliverBy', { date: formatDate(l.deliver_by, lang) })}</p>}
      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        <PlainButton icon={Eye} onClick={onSee} className="flex-1">
          {t('card.seeInTruck')}
        </PlainButton>
        <AddButton icon={PackagePlus} onClick={onAdd} loading={adding} disabled={disabled} className="flex-1">
          {t('card.add')}
        </AddButton>
      </div>
    </article>
  )
})
