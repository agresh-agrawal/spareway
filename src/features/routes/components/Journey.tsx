import { Ban, BedDouble, Coffee, Flag, MapPin, ShieldCheck, TriangleAlert, type LucideIcon } from 'lucide-react'
import { Badge, Card, CardHeader } from '@/components/common'
import { stopColor } from '@/components/common/chips'
import { formatDayTime } from '@/lib/format'
import { useLang } from '@/lib/i18n'
import type { StopRow } from '../api'
import type { PlannedRoute } from '../hooks'
import { journeyItems, journeyLabel, type JourneyItem } from '../lib/journey'

const ICON: Record<JourneyItem['kind'], LucideIcon> = {
  start: Flag,
  stop: MapPin,
  break: Coffee,
  overnight: BedDouble,
  no_entry_wait: Ban,
  checkpoint: ShieldCheck,
}

/** Start → stops → breaks / night rest / waits / check posts, each with its time. */
export function Journey({ route, stops }: { route: PlannedRoute; stops: StopRow[] }) {
  const { t, lang } = useLang('routes')
  const items = journeyItems(route.plan, stops)
  const late = new Set(route.plan.schedule.warnings.flatMap((w) => (w.code === 'LATE' ? [w.stopId] : [])))
  return (
    <Card>
      <CardHeader icon={MapPin} title={t('journey.title')} action={<Badge kind="estimated" />} />
      <ol className="flex flex-col">
        {items.map((item, i) => {
          const Icon = ICON[item.kind]
          const isStop = item.kind === 'stop' || item.kind === 'start'
          const seq = isStop ? item.stop.seq : 0
          return (
            <li key={i} className="flex items-start gap-3 border-b border-line py-3 last:border-b-0">
              <span
                className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-3"
                style={isStop && seq > 0 ? { background: stopColor(seq), color: '#121212' } : undefined}
              >
                {isStop && seq > 0 ? <span className="text-[13px] font-bold">{seq}</span> : <Icon size={18} aria-hidden className={item.kind === 'no_entry_wait' ? 'text-crit' : 'text-ink-2'} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className={isStop ? 'font-semibold' : undefined}>{journeyLabel(item, t, lang)}</div>
                <div className="flex flex-wrap items-center gap-2 text-label text-ink-2 tabular">
                  {formatDayTime(item.at, lang)}
                  {item.kind === 'stop' && late.has(item.stop.id) && (
                    <span className="inline-flex items-center gap-1 font-semibold text-warn">
                      <TriangleAlert size={14} aria-hidden />
                      {t('journey.late')}
                    </span>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}
