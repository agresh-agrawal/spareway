// Everything that goes on one layer as a list (same goods grouped): tap a row to see what it is.
import { Check, ChevronRight } from 'lucide-react'
import { stopColor } from '@/components/common'
import { useLang } from '@/lib/i18n'
import { formatCargoSize } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Placement } from '@/types/domain'
import { layerOf } from '../lib/position'

interface Group {
  label: string
  unloadOrder: number
  items: Placement[]
}

export function LayerList({
  placements,
  states,
  layer,
  band,
  currentStep,
  onPick,
}: {
  placements: Placement[]
  states: Map<string, 'done' | 'waiting' | 'issue' | 'planned'>
  layer: number
  band: number
  currentStep: number
  onPick: (p: Placement) => void
}) {
  const { t, td } = useLang('loader')
  const groups: Group[] = []
  for (const p of placements.filter((x) => layerOf(x, band) === layer).sort((a, b) => a.step - b.step)) {
    const g = groups.find((x) => x.label === p.label && x.unloadOrder === p.unloadOrder)
    if (g) g.items.push(p)
    else groups.push({ label: p.label, unloadOrder: p.unloadOrder, items: [p] })
  }
  if (groups.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[18px] font-semibold">{t('page.onLayer')}</h2>
        <span className="text-label text-ink-2">{t('page.tapItem')}</span>
      </div>
      <ul className="flex flex-col gap-2">
        {groups.map((g) => {
          const done = g.items.filter((p) => states.get(p.key) === 'done').length
          const issue = g.items.some((p) => states.get(p.key) === 'issue')
          const next = g.items.find((p) => states.get(p.key) !== 'done') ?? g.items[0]
          const all = done === g.items.length
          const here = g.items.some((p) => p.step === currentStep)
          const first = g.items[0]
          const steps =
            g.items.length === 1 ? `#${first.step}` : `#${first.step}–${g.items[g.items.length - 1].step}`
          return (
            <li key={`${g.label}-${g.unloadOrder}-${first.step}`}>
              <button
                type="button"
                onClick={() => onPick(next)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-tile border bg-surface-2 p-3 text-left',
                  here ? 'border-accent' : issue ? 'border-crit' : 'border-line-strong',
                )}
              >
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-[10px] font-bold text-white"
                  style={{ background: stopColor(g.unloadOrder) }}
                  aria-hidden
                >
                  {all ? <Check size={22} /> : g.items.length}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[18px] font-semibold">
                    {g.items.length > 1 ? `${g.items.length} × ${td(g.label)}` : td(g.label)}
                  </span>
                  <span className="block text-label text-ink-2 tabular">
                    {steps} · {formatCargoSize(first.l, first.w, first.h)} · {t('page.doneOf', { done, total: g.items.length })}
                  </span>
                </span>
                <ChevronRight size={20} className="shrink-0 text-ink-3" aria-hidden />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
