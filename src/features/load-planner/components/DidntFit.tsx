import { useMemo } from 'react'
import { CircleCheck, PackageX } from 'lucide-react'
import { Card, CardHeader } from '@/components/common'
import { formatCargoSize, formatWeight } from '@/lib/format'
import { useLang } from '@/lib/i18n'
import type { PackResult } from '@/types/domain'
import type { CargoRow } from '../api'
import { groupUnplaced, type UnplacedGroup } from '../lib/plan'

const m3 = (v: number) => (Math.round(v * 10) / 10).toFixed(1)

/** Interpolation values for the plain reason text (Engineering Reference 5 patterns). */
export function reasonValues(g: UnplacedGroup, metrics: PackResult['metrics']): Record<string, string> {
  return {
    size: formatCargoSize(...g.size),
    kg: formatWeight(g.kg),
    left: formatWeight(Math.max(0, metrics.remainingPayloadKg)),
    need: m3(g.m3),
    free: m3(metrics.freeVolumeM3),
  }
}

/** "Didn't fit": one row per cargo item + reason, with a plain reason and what to do. */
export function DidntFit({ result, cargo }: { result: PackResult; cargo: CargoRow[] }) {
  const { t, td } = useLang('load-planner')
  const groups = useMemo(() => groupUnplaced(result.unplaced, cargo), [result.unplaced, cargo])
  return (
    <Card>
      <CardHeader icon={PackageX} title={t('didntFit.title')} />
      {groups.length === 0 ? (
        <p className="flex items-center gap-2 font-medium text-ok">
          <CircleCheck size={20} aria-hidden />
          {t('didntFit.allFit')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {groups.map((g) => (
            <li key={`${g.cargoItemId}-${g.reason}`} className="flex gap-3 rounded-tile border border-crit/30 bg-crit/[0.05] p-3">
              <PackageX size={20} className="mt-0.5 shrink-0 text-crit" aria-hidden />
              <div className="min-w-0">
                <div className="font-semibold">{t('didntFit.group', { count: g.count, label: td(g.label) })}</div>
                <div className="mt-0.5">{t(`didntFit.reason.${g.reason}`, reasonValues(g, result.metrics))}</div>
                <div className="mt-1 text-label text-ink-2">{t(`didntFit.advice.${g.reason}`)}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
