import type { ReactNode } from 'react'
import { AlertTriangle, Inbox, RotateCcw, type LucideIcon } from 'lucide-react'
import { useLang } from '@/lib/i18n'
import { toAppError } from '@/lib/errors'
import { cn } from '@/lib/cn'
import { PlainButton } from './Buttons'

/** Icon + one line + one button. */
export function EmptyState({
  icon: Icon = Inbox,
  text,
  action,
  tone = 'default',
  className,
}: {
  icon?: LucideIcon
  text: ReactNode
  action?: ReactNode
  tone?: 'default' | 'ok'
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center gap-3 rounded-tile border border-dashed border-line-strong p-6 text-center', className)}>
      <Icon size={28} className={tone === 'ok' ? 'text-ok' : 'text-ink-3'} aria-hidden />
      <p className={cn('font-medium', tone === 'ok' ? 'text-ok' : 'text-ink-2')}>{text}</p>
      {action}
    </div>
  )
}

/** Plain message + Retry. */
export function ErrorState({ error, onRetry, className }: { error?: unknown; onRetry?: () => void; className?: string }) {
  const { t } = useLang()
  const code = error ? toAppError(error).code : 'UNKNOWN'
  return (
    <div className={cn('flex flex-col items-center gap-3 rounded-tile border border-crit/30 bg-crit/[0.05] p-6 text-center', className)} role="alert">
      <AlertTriangle size={28} className="text-crit" aria-hidden />
      <p className="font-medium">{t(`errors.${code}`)}</p>
      {onRetry && (
        <PlainButton icon={RotateCcw} onClick={onRetry}>
          {t('actions.retry')}
        </PlainButton>
      )}
    </div>
  )
}

/** Grey shapes like the content. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-tile bg-surface-2', className)} aria-hidden />
}

export function SkeletonList({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3', className)} aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-16" />
      ))}
    </div>
  )
}

/** Centred full-screen message (loading app, setting up demo, missing env, errors). */
export function FullScreenMessage({
  icon: Icon,
  title,
  text,
  action,
  spinning,
}: {
  icon?: LucideIcon
  title: ReactNode
  text?: ReactNode
  action?: ReactNode
  spinning?: boolean
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas p-6 text-center">
      <img src="/brand/spareway-mark.svg" alt="" className={cn('size-16', spinning && 'animate-pulse-soft')} />
      {Icon && <Icon size={28} className="text-ink-2" aria-hidden />}
      <h1 className="text-section-title font-semibold">{title}</h1>
      {text && <p className="max-w-sm text-ink-2">{text}</p>}
      {action}
    </div>
  )
}
