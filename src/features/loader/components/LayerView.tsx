// Loader page (owner request 2): the truck drawn upright — cab at the top, doors at the bottom, as the loader
// sees it standing at the doors — one layer at a time. Layer buttons are stacked like the load: top layer on top,
// floor at the bottom. Boxes on the layers below are drawn grey so the loader sees what they stand on.
import { useMemo } from 'react'
import type { PackContainer, Placement } from '@/types/domain'
import { stopColor } from '@/components/common'
import { useLang } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import { layerBand, layerCount, layerOf } from '../lib/position'

type BoxState = 'done' | 'waiting' | 'issue' | 'planned'

export function LayerView({
  container,
  placements,
  highlightKey,
  states,
  visibleSteps,
  layer,
  onLayer,
}: {
  container: Pick<PackContainer, 'lengthCm' | 'widthCm'>
  placements: Placement[]
  highlightKey: string | null
  states: Map<string, BoxState>
  visibleSteps: number
  /** 1 = floor */
  layer: number
  onLayer: (n: number) => void
}) {
  const { t, td } = useLang('loader')
  const band = useMemo(() => layerBand(placements), [placements])
  const count = useMemo(() => layerCount(placements), [placements])
  const visible = placements.filter((p) => p.step <= visibleSteps)
  const W = container.widthCm
  const L = container.lengthCm
  const PAD = 10
  // standing at the doors looking in (cab at the top), the truck's left side (y = 0) is on the left
  const toX = (p: Placement) => p.y
  const below = visible.filter((p) => layerOf(p, band) < layer)
  const here = visible.filter((p) => layerOf(p, band) === layer)
  const word = (n: number) => (n <= 3 ? t(`page.layer.${n}`) : t('page.layer.n', { n }))

  return (
    <div className="flex gap-3">
      <div role="group" aria-label={t('page.layers')} className="flex w-24 shrink-0 flex-col-reverse justify-end gap-2 self-start">
        {Array.from({ length: count }, (_, i) => i + 1).map((n) => {
          const boxes = placements.filter((p) => layerOf(p, band) === n)
          const done = boxes.filter((p) => states.get(p.key) === 'done').length
          return (
            <button
              key={n}
              type="button"
              aria-pressed={layer === n}
              onClick={() => onLayer(n)}
              className={cn(
                'flex min-h-16 flex-col items-center justify-center rounded-tile border px-1 text-center',
                layer === n ? 'border-accent bg-accent-soft text-accent' : 'border-line-strong bg-surface-2',
              )}
            >
              <span className="text-[16px] leading-5 font-semibold">{word(n)}</span>
              <span className="text-label text-ink-2 tabular">
                {done}/{boxes.length}
              </span>
            </button>
          )
        })}
      </div>
      <figure className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="text-center text-label font-semibold text-ink-2">{t('common:words.cabSide')}</div>
        <svg viewBox={`${-PAD} ${-PAD} ${W + PAD * 2} ${L + PAD * 2}`} className="mx-auto max-h-[60vh] w-full" role="img" aria-label={word(layer)}>
          <rect x={0} y={0} width={W} height={L} rx={6} className="fill-surface-2 stroke-line-strong" strokeWidth={2} />
          <line x1={0} x2={W} y1={L + 5} y2={L + 5} className="stroke-ink-2" strokeWidth={5} />
          {below.map((p) => (
            <rect key={p.key} x={toX(p) + 1} y={p.x + 1} width={Math.max(0, p.w - 2)} height={Math.max(0, p.l - 2)} rx={2} className="fill-surface-3 stroke-line" strokeWidth={1.5} />
          ))}
          {here.map((p) => {
            const st = states.get(p.key)
            const hi = p.key === highlightKey
            const size = Math.min(p.w, p.l)
            return (
              <g key={p.key}>
                <rect
                  x={toX(p) + 1}
                  y={p.x + 1}
                  width={Math.max(0, p.w - 2)}
                  height={Math.max(0, p.l - 2)}
                  rx={3}
                  fill={st === 'issue' ? 'var(--color-crit)' : stopColor(p.unloadOrder)}
                  fillOpacity={hi ? 0.95 : st === 'done' ? 0.75 : 0.35}
                  stroke={hi ? 'var(--color-accent)' : 'rgba(0,0,0,0.45)'}
                  strokeWidth={hi ? 6 : 1.5}
                >
                  <title>{`${p.step}. ${td(p.label)}`}</title>
                </rect>
                {size >= 30 && (
                  <text
                    x={toX(p) + p.w / 2}
                    y={p.x + p.l / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={Math.min(40, size * 0.45)}
                    fontWeight={700}
                    className="fill-ink"
                  >
                    {p.step}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
        <div className="text-center text-label font-semibold text-ink-2">{t('common:words.doorSide')}</div>
      </figure>
    </div>
  )
}
