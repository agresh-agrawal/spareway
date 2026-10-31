import { ArrowRight, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { MainButton } from './Buttons'

/** Accent-soft card: "Next: plan the load" + one MainButton. Always exactly one on a trip. */
export function NextStepCard({
  title,
  text,
  actionLabel,
  icon = ArrowRight,
  onAction,
  loading,
}: {
  title: ReactNode
  text?: ReactNode
  actionLabel: ReactNode
  icon?: LucideIcon
  onAction: () => void
  loading?: boolean
}) {
  return (
    <div className="flex flex-col gap-4 rounded-card border border-accent/25 bg-accent-soft p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div>
        <div className="text-section-title font-semibold text-accent">{title}</div>
        {text && <p className="mt-1 text-ink-2">{text}</p>}
      </div>
      <MainButton icon={icon} onClick={onAction} loading={loading} className="w-full sm:w-auto">
        {actionLabel}
      </MainButton>
    </div>
  )
}
