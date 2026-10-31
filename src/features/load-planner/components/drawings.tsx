// Top and side drawings of a load plan (SVG). Used when 3D is off (low-data, no WebGL), on the truck tab and
// by the loader page (Phase 2). Cab on the left, doors on the right.
import { useMemo } from 'react'
import type { PackContainer, Placement } from '@/types/domain'
import { stopColor } from '@/components/common/chips'
import { useLang } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import type { BoxState } from '../lib/plan'

export interface DrawingProps {
  container: Pick<PackContainer, 'lengthCm' | 'widthCm' | 'heightCm'>
  placements: Placement[]
  /** lime outline on this box */
  highlightKey?: string | null
  /** loading progress: done solid, waiting faded, issue red */
  states?: Map<string, BoxState>
  /** only boxes with step ≤ this are drawn ("Play loading order") */
  visibleSteps?: number
  onSelect?: (key: string) => void
  className?: string
  /** hide the Cab side / Door side words (tiny drawings) */
  bare?: boolean
}

const PAD = 14

function fillOpacity(state: BoxState | undefined) {
  return state === 'waiting' ? 0.35 : 0.85
}

function stroke(p: Placement, highlight: boolean, state: BoxState | undefined) {
  if (highlight) return '#e3f58c'
  if (state === 'issue') return '#ef4444'
  if (p.fragile) return '#f5a524'
  return 'rgba(0,0,0,0.55)'
}

function Drawing({
  axis,
  container,
  placements,
  highlightKey,
  states,
  visibleSteps,
  onSelect,
  className,
  bare,
}: DrawingProps & { axis: 'top' | 'side' }) {
  const { t, td } = useLang('load-planner')
  const L = container.lengthCm
  const D = axis === 'top' ? container.widthCm : container.heightCm
  // top: y down the drawing (left side of the truck on top); side: z up
  const boxes = useMemo(() => {
    const visible = placements.filter((p) => visibleSteps === undefined || p.step <= visibleSteps)
    // draw the boxes further from the viewer first
    const sorted =
      axis === 'top'
        ? [...visible].sort((a, b) => a.z - b.z || a.step - b.step)
        : [...visible].sort((a, b) => a.y - b.y || a.step - b.step)
    // the selected box is drawn last so it is never hidden
    return highlightKey ? [...sorted.filter((p) => p.key !== highlightKey), ...sorted.filter((p) => p.key === highlightKey)] : sorted
  }, [placements, visibleSteps, axis, highlightKey])
  const grid = []
  for (let x = 50; x < L; x += 50) grid.push(x)
  const gridD = []
  for (let d = 50; d < D; d += 50) gridD.push(d)

  const title = axis === 'top' ? t('view.top') : t('view.side')
  return (
    <figure className={cn('flex flex-col gap-1', className)}>
      {!bare && (
        <div className="flex justify-between text-label text-ink-3">
          <span>{t('common:words.cabSide')}</span>
          <span>{t('common:words.doorSide')}</span>
        </div>
      )}
      <svg
        viewBox={`${-PAD} ${-PAD} ${L + PAD * 2} ${D + PAD * 2}`}
        className="h-auto w-full"
        role="img"
        aria-label={`${title}: ${placements.length}`}
      >
        <rect x={0} y={0} width={L} height={D} rx={6} fill="#1b1b1e" stroke="#6b6b73" strokeWidth={2} />
        {grid.map((x) => (
          <line key={`gx${x}`} x1={x} x2={x} y1={0} y2={D} stroke="rgba(255,255,255,0.07)" strokeDasharray="6 6" strokeWidth={1.5} />
        ))}
        {gridD.map((d) => (
          <line key={`gd${d}`} x1={0} x2={L} y1={d} y2={d} stroke="rgba(255,255,255,0.07)" strokeDasharray="6 6" strokeWidth={1.5} />
        ))}
        {/* doors */}
        <line x1={L + 4} x2={L + 4} y1={0} y2={D} stroke="rgba(227,245,140,0.4)" strokeWidth={5} />
        {boxes.map((p) => {
          const hi = p.key === highlightKey
          const st = states?.get(p.key)
          const x = p.x
          const y = axis === 'top' ? p.y : D - p.z - p.h
          const w = p.l
          const h = axis === 'top' ? p.w : p.h
          return (
            <rect
              key={p.key}
              x={x + 0.75}
              y={y + 0.75}
              width={Math.max(0, w - 1.5)}
              height={Math.max(0, h - 1.5)}
              rx={2}
              fill={st === 'issue' ? '#ef4444' : stopColor(p.unloadOrder)}
              fillOpacity={highlightKey && !hi ? 0.3 : fillOpacity(st)}
              stroke={stroke(p, hi, st)}
              strokeWidth={hi ? 5 : 1.5}
              onClick={onSelect ? () => onSelect(p.key) : undefined}
              className={onSelect ? 'cursor-pointer' : undefined}
            >
              <title>{`${p.step}. ${td(p.label)}`}</title>
            </rect>
          )
        })}
      </svg>
    </figure>
  )
}

/** Looking down from the roof. */
export function TopView(props: DrawingProps) {
  return <Drawing axis="top" {...props} />
}

/** Looking at the truck from the side, cab on the left (same as the 3D side view). */
export function SideView(props: DrawingProps) {
  return <Drawing axis="side" {...props} />
}
