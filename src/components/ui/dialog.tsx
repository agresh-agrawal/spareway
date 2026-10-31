// shadcn-style wrappers over radix-ui Dialog (used by Sheet and ConfirmDialog).
import { Dialog as D } from 'radix-ui'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

export const Dialog = D.Root
export const DialogTrigger = D.Trigger
export const DialogClose = D.Close
export const DialogTitle = D.Title
export const DialogDescription = D.Description

export function DialogOverlay({ className, ...props }: ComponentProps<typeof D.Overlay>) {
  return <D.Overlay className={cn('fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px]', className)} {...props} />
}

export function DialogContent({ className, children, ...props }: ComponentProps<typeof D.Content>) {
  return (
    <D.Portal>
      <DialogOverlay />
      <D.Content
        className={cn(
          'fixed top-1/2 left-1/2 z-50 w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2',
          'rounded-card border border-line-strong bg-surface p-5 shadow-2xl focus:outline-none',
          className,
        )}
        {...props}
      >
        {children}
      </D.Content>
    </D.Portal>
  )
}
