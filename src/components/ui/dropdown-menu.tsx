import { DropdownMenu as M } from 'radix-ui'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

export const DropdownMenu = M.Root
export const DropdownMenuTrigger = M.Trigger

export function DropdownMenuContent({ className, sideOffset = 8, ...props }: ComponentProps<typeof M.Content>) {
  return (
    <M.Portal>
      <M.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-60 rounded-tile border border-line-strong bg-surface-2 p-1.5 shadow-2xl',
          className,
        )}
        {...props}
      />
    </M.Portal>
  )
}

export function DropdownMenuItem({ className, ...props }: ComponentProps<typeof M.Item>) {
  return (
    <M.Item
      className={cn(
        'flex min-h-12 cursor-pointer items-center gap-3 rounded-[10px] px-3 text-body text-ink outline-none',
        'data-[highlighted]:bg-surface-3',
        className,
      )}
      {...props}
    />
  )
}

export function DropdownMenuSeparator({ className, ...props }: ComponentProps<typeof M.Separator>) {
  return <M.Separator className={cn('my-1 h-px bg-line', className)} {...props} />
}

export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof M.Label>) {
  return <M.Label className={cn('px-3 py-2 text-label text-ink-2', className)} {...props} />
}
