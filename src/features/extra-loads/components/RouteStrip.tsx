// Simple km line with the stops and an arc per load (Design System 7.13). Tap an arc ↔ its card.
import { stopColor } from '@/components/common/chips'
import { useLang } from '@/lib/i18n'
import { makeLine, project, type LngLat } from '@/features/routes'
import type { StopRow } from '../api'
import type { Candidate } from '../lib/candidates'

const W = 1000
const H = 120
const BASE = 92
const PAD = 24

export function RouteStrip({
  line,
  stops,
  loads,
  selectedId,
  onSelect,
}: {
  line: LngLat[]
  stops: StopRow[]
  loads: Candidate[]
  selectedId?: string
  onSelect: (listingId: string) => void
}) {
  const { t, td } = useLang('extra-loads')
  const l = makeLine(line)
  const total = Math.max(1, l.lengthKm)
  const x = (km: number) => PAD + (Math.max(0, Math.min(total, km)) / total) * (W - 2 * PAD)
  let seg = 0
  const stopX = [...stops]
    .sort((a, b) => a.seq - b.seq)
    .map((s) => {
      const pr = project(l, [s.lng, s.lat], seg)
      seg = pr.segment
      return { s, x: x(s.seq === 0 ? 0 : pr.km) }
    })
  return (
    <figure className="rounded-card border border-line bg-surface p-3 sm:p-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={t('strip.label')}>
        <line x1={PAD} x2={W - PAD} y1={BASE} y2={BASE} stroke="#6b6b73" strokeWidth={4} strokeLinecap="round" />
        {loads.map((c) => {
          const x1 = x(c.pickupKm)
          const x2 = x(c.dropKm)
          const mid = (x1 + x2) / 2
          const rise = Math.min(70, 18 + Math.abs(x2 - x1) * 0.25)
          const on = c.listingId === selectedId
          return (
            <path
              key={c.listingId}
              d={`M ${x1} ${BASE} Q ${mid} ${BASE - rise * 2} ${x2} ${BASE}`}
              fill="none"
              stroke={on ? '#e3f58c' : '#4ade80'}
              strokeOpacity={on ? 1 : 0.55}
              strokeWidth={on ? 5 : 3}
              className="cursor-pointer"
              onClick={() => onSelect(c.listingId)}
            >
              <title>{`${c.code} · ${td(c.listing.pickup_name)} → ${td(c.listing.drop_name)}`}</title>
            </path>
          )
        })}
        {stopX.map(({ s, x: sx }) => (
          <g key={s.id}>
            <circle cx={sx} cy={BASE} r={13} fill={stopColor(s.seq)} stroke="var(--color-canvas)" strokeWidth={2} />
            <text x={sx} y={BASE + 5} textAnchor="middle" fontSize={14} fontWeight={700} fill="#121212">
              {s.seq}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="mt-1 flex justify-between text-label text-ink-2 tabular">
        <span>{td(stopX[0]?.s.name)}</span>
        <span>{t('strip.km', { km: Math.round(total) })}</span>
        <span>{td(stopX.at(-1)?.s.name)}</span>
      </figcaption>
    </figure>
  )
}
