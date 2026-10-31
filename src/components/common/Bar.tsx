import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** green < 70 %, amber 70–90 %, red > 90 % */
export function barTone(pct: number): 'ok' | 'warn' | 'crit' {
  if (pct > 90) return 'crit'
  if (pct >= 70) return 'warn'
  return 'ok'
}

const fill = { ok: 'bg-ok', warn: 'bg-warn', crit: 'bg-crit' }

/** Label + % as text + bar. */
export function Bar({ label, pct, hint, className }: { label: ReactNode; pct: number; hint?: ReactNode; className?: string }) {
  const safe = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0))
  const tone = barTone(pct)
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-ink-2">{label}</span>
        <span className="text-[18px] font-semibold tabular">{Math.round(pct)}%</span>
      </div>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-surface-3"
        role="progressbar"
        aria-valuenow={Math.round(safe)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={cn('h-full rounded-full transition-[width] duration-200', fill[tone])} style={{ width: `${safe}%` }} />
      </div>
      {hint && <span className="text-label text-ink-3">{hint}</span>}
    </div>
  )
}
