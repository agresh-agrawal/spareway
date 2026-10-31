import { Tooltip as T } from 'radix-ui'
import type { ReactNode } from 'react'

export const TooltipProvider = T.Provider

export function Tooltip({ label, children, side = 'right' }: { label: string; children: ReactNode; side?: 'right' | 'bottom' | 'top' | 'left' }) {
  return (
    <T.Root delayDuration={150}>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={10}
          className="z-50 rounded-[10px] border border-line-strong bg-surface-3 px-3 py-1.5 text-label text-ink shadow-xl"
        >
          {label}
        </T.Content>
      </T.Portal>
    </T.Root>
  )
}
