// Tap any box (in the drawing or the list) → what it is: name, size, weight, care, where it goes and where it is
// unloaded, plus "Mark loaded" / "Not loaded — undo" / "Problem" / "Load this one next".
import type { ReactNode } from 'react'
import { AlertTriangle, ArrowRight, Check, Package, RotateCcw } from 'lucide-react'
import { MainButton, PlainButton, Sheet, StopChip, stopColor } from '@/components/common'
import { useLang } from '@/lib/i18n'
import { formatCargoSize, formatWeight } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { PackContainer, Placement } from '@/types/domain'
import { positionWords } from '../lib/position'

export type ItemStatus = 'pending' | 'done' | 'issue'

const HEAVY_KG = 40

export function ItemSheet({
  item,
  all,
  status,
  container,
  stopName,
  busy,
  onClose,
  onMark,
  onProblem,
  onGoTo,
}: {
  item: Placement | null
  all: Placement[]
  status: ItemStatus
  container: Pick<PackContainer, 'lengthCm' | 'widthCm'>
  stopName?: string
  busy: boolean
  onClose: () => void
  onMark: (p: Placement, status: 'done' | 'pending') => void
  onProblem: (p: Placement) => void
  onGoTo: (p: Placement) => void
}) {
  const { t, td } = useLang('loader')
  if (!item) return null
  const words = positionWords(item, container, all)
  const same = all.filter((p) => p.label === item.label).sort((a, b) => a.step - b.step)
  const index = same.findIndex((p) => p.step === item.step) + 1
  const layerWord = words.layer <= 3 ? t(`page.layer.${words.layer}`) : t('page.layer.n', { n: words.layer })
  const rows: [string, ReactNode][] = [
    [t('page.item.size'), formatCargoSize(item.l, item.w, item.h)],
    [t('page.item.weight'), formatWeight(item.weightKg)],
    [t('page.item.where'), `${t(`page.along.${words.along}`)} · ${t(`page.across.${words.across}`)} · ${layerWord}`],
  ]

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={t('page.item.title', { step: item.step })}
      footer={
        <div className="flex flex-col gap-2">
          {status === 'done' ? (
            <PlainButton icon={RotateCcw} onClick={() => onMark(item, 'pending')} disabled={busy} className="h-14 w-full text-[18px]">
              {t('page.item.markNot')}
            </PlainButton>
          ) : (
            <MainButton icon={Check} size="lg" onClick={() => onMark(item, 'done')} loading={busy} className="w-full">
              {t('page.item.markLoaded')}
            </MainButton>
          )}
          <div className="grid grid-cols-2 gap-2">
            <PlainButton icon={AlertTriangle} onClick={() => onProblem(item)} className="h-14 text-[17px]">
              {t('page.problem')}
            </PlainButton>
            <PlainButton icon={ArrowRight} onClick={() => onGoTo(item)} className="h-14 text-[17px]">
              {t('page.item.goTo')}
            </PlainButton>
          </div>
        </div>
      }
    >
      <div className="flex items-start gap-3">
        <span
          className="flex size-14 shrink-0 items-center justify-center rounded-tile text-white"
          style={{ background: stopColor(item.unloadOrder) }}
          aria-hidden
        >
          <Package size={28} />
        </span>
        <div className="min-w-0">
          <div className="text-label text-ink-2">{t('page.item.what')}</div>
          <div className="text-[24px] leading-8 font-semibold">{td(item.label)}</div>
          {same.length > 1 && (
            <div className="text-ink-2">{t('page.item.same', { i: index, n: same.length, label: td(item.label) })}</div>
          )}
        </div>
      </div>

      <div
        className={cn(
          'mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold',
          status === 'done' ? 'bg-ok/15 text-ok' : status === 'issue' ? 'bg-crit/15 text-crit' : 'bg-surface-3 text-ink-2',
        )}
      >
        {t(`page.item.status.${status}`)}
      </div>

      <dl className="mt-4 flex flex-col divide-y divide-line rounded-tile border border-line">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3 px-3 py-3">
            <dt className="text-ink-2">{k}</dt>
            <dd className="text-right text-[18px] font-semibold tabular">{v}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 px-3 py-3">
          <dt className="text-ink-2">{t('page.item.goesTo')}</dt>
          <dd>{stopName ? <StopChip seq={item.unloadOrder} name={stopName} /> : '—'}</dd>
        </div>
      </dl>

      <ul className="mt-3 flex flex-col gap-1.5 text-[17px]">
        {item.fragile && <li className="font-medium text-warn">{t('page.fragile')}</li>}
        {item.weightKg >= HEAVY_KG && <li className="font-medium text-warn">{t('page.item.heavy')}</li>}
        <li className="text-ink-2">{t('page.item.unloadHint', { n: item.unloadOrder })}</li>
      </ul>
    </Sheet>
  )
}
