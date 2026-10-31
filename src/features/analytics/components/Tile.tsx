import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Compact tile: icon, one number, one-line label (3 per row also at 375 px in Hindi). */
export function Tile({ icon: Icon, value, label, tone, extra }: { icon: LucideIcon; value: string; label: string; tone?: 'ok'; extra?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-tile border border-line bg-surface-2 p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <Icon size={24} aria-hidden className={tone === 'ok' ? 'text-ok' : 'text-ink-2'} />
        {extra}
      </div>
      <span className={cn('text-[16px] leading-6 font-semibold tabular sm:text-[26px] sm:leading-8', tone === 'ok' && 'text-ok')}>{value}</span>
      <span className="text-label text-ink-2">{label}</span>
    </div>
  )
}
