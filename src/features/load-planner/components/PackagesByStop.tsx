import { useMemo, useState } from 'react'
import { ArrowUpFromLine, ChevronDown, Eye, GlassWater, Layers } from 'lucide-react'
import { Card, CardHeader, PlainButton, StopChip } from '@/components/common'
import { formatCargoSize, formatWeight } from '@/lib/format'
import { useLang } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import type { PackResult } from '@/types/domain'
import type { CargoRow, StopRow } from '../api'
import { placementsByStop } from '../lib/plan'

/** Right panel: one expandable card per drop stop (step range, boxes, kg), item rows with "Show in truck". */
export function PackagesByStop({
  result,
  stops,
  cargo,
  selectedKey,
  onShow,
}: {
  result: PackResult
  stops: StopRow[]
  cargo: CargoRow[]
  selectedKey?: string | null
  onShow: (key: string) => void
}) {
  const { t, td } = useLang('load-planner')
  const groups = useMemo(() => placementsByStop(result.placements), [result.placements])
  const rows = useMemo(() => new Map(cargo.map((c) => [c.id, c])), [cargo])
  const selectedRow = selectedKey ? selectedKey.split('#')[0] : null
  const selectedStop = result.placements.find((p) => p.key === selectedKey)?.unloadOrder
  const [open, setOpen] = useState<number | null>(groups[0]?.unloadOrder ?? null)
  // a new "Show in truck" / tap on a box opens that box's stop
  const [seenKey, setSeenKey] = useState(selectedKey)
  if (seenKey !== selectedKey) {
    setSeenKey(selectedKey)
    if (selectedStop !== undefined) setOpen(selectedStop)
  }
  const openStop = open

  return (
    <Card>
      <CardHeader icon={Layers} title={t('packages.title')} />
      <div className="flex flex-col gap-2">
        {groups.map((g) => {
          const stop = stops.find((s) => s.seq === g.unloadOrder)
          const isOpen = openStop === g.unloadOrder
          // one row per cargo item in this stop, in loading order
          const items = new Map<string, { first: string; count: number }>()
          for (const p of g.placements) {
            const cur = items.get(p.cargoItemId)
            items.set(p.cargoItemId, cur ? { ...cur, count: cur.count + 1 } : { first: p.key, count: 1 })
          }
          return (
            <div key={g.unloadOrder} className="rounded-tile border border-line bg-surface-2">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? -1 : g.unloadOrder)}
                className="flex min-h-14 w-full flex-wrap items-center gap-x-3 gap-y-1 p-3 text-left"
              >
                <StopChip seq={g.unloadOrder} name={stop?.name ?? ''} className="max-w-full" />
                <span className="text-label text-ink-2 tabular">
                  {t('packages.steps', { from: g.firstStep, to: g.lastStep })} · {t('packages.boxes', { count: g.placements.length })} ·{' '}
                  {formatWeight(g.kg)}
                </span>
                <ChevronDown size={20} aria-hidden className={cn('ml-auto shrink-0 text-ink-2 transition-transform duration-200', isOpen && 'rotate-180')} />
              </button>
              {isOpen && (
                <ul className="flex flex-col gap-2 border-t border-line p-3">
                  {[...items.entries()].map(([id, info]) => {
                    const row = rows.get(id)
                    if (!row) return null
                    const active = selectedRow === id
                    return (
                      <li key={id} className={cn('rounded-tile border bg-surface p-3', active ? 'border-accent' : 'border-line')}>
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="font-semibold">{td(row.label)}</span>
                          <span className="text-ink-2 tabular">× {info.count}</span>
                        </div>
                        <div className="mt-1 text-label text-ink-2">
                          {row.client_name && <>{td(row.client_name)} · </>}
                          {formatCargoSize(row.length_cm, row.width_cm, row.height_cm)} ·{' '}
                          {t('packages.each', { kg: formatWeight(row.weight_kg) })}
                        </div>
                        {(row.fragile || row.upright_only || !row.stackable) && (
                          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-label">
                            {row.fragile && (
                              <li className="flex items-center gap-1 text-warn">
                                <GlassWater size={16} aria-hidden />
                                {t('packages.fragileNote')}
                              </li>
                            )}
                            {row.upright_only && (
                              <li className="flex items-center gap-1 text-ink-2">
                                <ArrowUpFromLine size={16} aria-hidden />
                                {t('packages.uprightNote')}
                              </li>
                            )}
                            {!row.stackable && !row.fragile && (
                              <li className="flex items-center gap-1 text-ink-2">
                                <Layers size={16} aria-hidden />
                                {t('packages.noStackNote')}
                              </li>
                            )}
                          </ul>
                        )}
                        <PlainButton icon={Eye} className="mt-3 w-full sm:w-auto" onClick={() => onShow(info.first)}>
                          {t('packages.showInTruck')}
                        </PlainButton>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
