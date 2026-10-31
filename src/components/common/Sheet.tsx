import { Dialog as D } from 'radix-ui'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useLang } from '@/lib/i18n'
import { cn } from '@/lib/cn'

/**
 * Side sheet 480 px on laptop, full screen on phone, main button fixed at the bottom.
 * Esc / outside click close unless `dirty` (typed text would be lost).
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  dirty,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  dirty?: boolean
}) {
  const { t } = useLang()
  const guard = (e: Event) => {
    if (dirty) e.preventDefault()
  }
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/70" />
        <D.Content
          onEscapeKeyDown={guard}
          onPointerDownOutside={guard}
          aria-describedby={description ? undefined : undefined}
          className={cn(
            'fixed inset-0 z-50 flex flex-col bg-surface focus:outline-none',
            'sm:inset-y-3 sm:right-3 sm:left-auto sm:w-[480px] sm:rounded-card sm:border sm:border-line-strong',
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b border-line p-4 sm:p-5">
            <div>
              <D.Title className="text-section-title font-semibold">{title}</D.Title>
              {description ? (
                <D.Description className="mt-1 text-ink-2">{description}</D.Description>
              ) : (
                <D.Description className="sr-only">{typeof title === 'string' ? title : ''}</D.Description>
              )}
            </div>
            <D.Close
              aria-label={t('shell.close')}
              className="-mt-1 -mr-1 flex size-12 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-surface-3 hover:text-ink"
            >
              <X size={22} />
            </D.Close>
          </div>
          <div className="flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>
          {footer && <div className="safe-bottom border-t border-line p-4 sm:p-5">{footer}</div>}
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}
