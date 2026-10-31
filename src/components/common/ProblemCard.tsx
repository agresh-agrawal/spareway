import { AlertOctagon, AlertTriangle, Check, Info, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useLang } from '@/lib/i18n'
import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/cn'

const sev: Record<string, { bar: string; icon: LucideIcon; text: string; bg: string }> = {
  critical: { bar: 'bg-crit', icon: AlertOctagon, text: 'text-crit', bg: 'bg-crit/[0.06]' },
  warning: { bar: 'bg-warn', icon: AlertTriangle, text: 'text-warn', bg: 'bg-warn/[0.06]' },
  info: { bar: 'bg-info', icon: Info, text: 'text-info', bg: 'bg-info/[0.05]' },
}

/** Left colour bar, icon, one-line title (from kind + meta), chip, time, "Done". */
export function ProblemCard({
  severity,
  title,
  chip,
  createdAt,
  onDone,
  busy,
}: {
  severity: string
  title: ReactNode
  chip?: ReactNode
  createdAt: string
  onDone?: () => void
  busy?: boolean
}) {
  const { t, lang } = useLang()
  const s = sev[severity] ?? sev.info
  const Icon = s.icon
  return (
    <div className={cn('relative flex items-center gap-3 overflow-hidden rounded-tile border border-line py-3 pr-3 pl-5', s.bg)}>
      <span className={cn('absolute inset-y-0 left-0 w-1.5', s.bar)} aria-hidden />
      <Icon size={22} className={cn('shrink-0', s.text)} aria-label={t(`severity.${severity}`)} />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 font-medium">{title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-label text-ink-2">
          {chip}
          <span>{formatRelative(createdAt, lang)}</span>
        </div>
      </div>
      {onDone && (
        <button
          onClick={onDone}
          disabled={busy}
          className="inline-flex h-12 shrink-0 items-center gap-1.5 rounded-control border border-line-strong bg-surface-2 px-3 font-semibold hover:bg-surface-3 disabled:opacity-50"
        >
          <Check size={20} aria-hidden />
          {t('actions.done')}
        </button>
      )}
    </div>
  )
}
