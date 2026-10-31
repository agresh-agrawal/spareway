import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Badge, Logo, PlainButton } from '@/components/common'
import { useLang } from '@/lib/i18n'

export function AboutDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useLang()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <Logo />
        <DialogTitle className="mt-4 text-section-title font-semibold">{t('app.about')}</DialogTitle>
        <DialogDescription className="mt-2 text-ink-2">{t('app.aboutText')}</DialogDescription>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge kind="sample" />
          <Badge kind="simulated" />
          <Badge kind="ai" />
          <Badge kind="estimated" />
        </div>
        <p className="mt-2 text-label text-ink-2">{t('app.aboutSample')}</p>
        <PlainButton className="mt-6 w-full" onClick={() => onOpenChange(false)}>
          {t('shell.close')}
        </PlainButton>
      </DialogContent>
    </Dialog>
  )
}
