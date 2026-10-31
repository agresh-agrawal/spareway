import type { ReactNode } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useLang } from '@/lib/i18n'
import { MainButton, PlainButton } from './Buttons'
import type { LucideIcon } from 'lucide-react'

/** Confirm before anything that can't be undone. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  text,
  confirmLabel,
  confirmIcon,
  onConfirm,
  loading,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  text?: ReactNode
  confirmLabel: ReactNode
  confirmIcon?: LucideIcon
  onConfirm: () => void
  loading?: boolean
}) {
  const { t } = useLang()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle className="text-section-title font-semibold">{title}</DialogTitle>
        <DialogDescription className="mt-2 text-ink-2">{text}</DialogDescription>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <PlainButton onClick={() => onOpenChange(false)}>{t('actions.cancel')}</PlainButton>
          <MainButton icon={confirmIcon} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </MainButton>
        </div>
      </DialogContent>
    </Dialog>
  )
}
