import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

type Tone = 'default' | 'ok' | 'warn' | 'crit'

const toneClass: Record<Tone, string> = {
  default: 'text-ink-2',
  ok: 'text-ok',
  warn: 'text-warn',
  crit: 'text-crit',
}

/** Icon 24 · big number · one-line label. Max 3 per row; tap opens the list behind it. */
export function BigTile({
  icon: Icon,
  value,
  label,
  tone = 'default',
  to,
  extra,
}: {
  icon: LucideIcon
  value: ReactNode
  label: ReactNode
  tone?: Tone
  to?: string
  extra?: ReactNode
}) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <span className={cn('flex size-10 items-center justify-center rounded-full bg-surface-3', toneClass[tone])}>
          <Icon size={24} aria-hidden />
        </span>
        {extra}
      </div>
      <div className={cn('mt-3 text-[28px] leading-9 font-semibold tabular sm:text-big-number', tone === 'crit' && 'text-crit')}>
        {value}
      </div>
      <div className="mt-0.5 text-ink-2">{label}</div>
    </>
  )
  const cls = 'block rounded-tile border border-line bg-surface-2 p-4 transition-colors duration-200'
  return to ? (
    <Link to={to} className={cn(cls, 'hover:bg-surface-3')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}
