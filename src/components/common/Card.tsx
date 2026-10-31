import type { HTMLAttributes, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-card border border-line bg-surface p-4 sm:p-5', className)} {...props} />
}

export function CardHeader({
  icon: Icon,
  title,
  action,
  className,
}: {
  icon?: LucideIcon
  title: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-4 flex min-h-8 items-center justify-between gap-3', className)}>
      <h2 className="flex items-center gap-2 text-section-title font-semibold">
        {Icon && <Icon size={20} className="shrink-0 text-ink-2" aria-hidden />}
        {title}
      </h2>
      {action}
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-5 flex flex-wrap items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        <h1 className="text-[22px] leading-7 font-semibold sm:text-page-title">{title}</h1>
        {subtitle && <p className="mt-1 text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
