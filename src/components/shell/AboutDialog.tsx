import { Package, Route, Truck, UserRound, Users } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Logo, PlainButton } from '@/components/common'
import { useLang } from '@/lib/i18n'

const WHO = [
  { key: 'owner', icon: Truck },
  { key: 'driver', icon: Route },
  { key: 'loader', icon: Package },
  { key: 'provider', icon: Users },
] as const

/** About Spareway: what it does and who uses it, in plain words. */
export function AboutDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useLang()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <Logo />
        <DialogTitle className="mt-4 text-page-title font-semibold">{t('app.about')}</DialogTitle>
        <DialogDescription className="mt-2 text-ink-2">{t('app.aboutText')}</DialogDescription>

        <h3 className="mt-6 text-section-title font-semibold">{t('app.aboutWhat')}</h3>
        <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-ink-2">
          {(['plan', 'route', 'extra', 'earn'] as const).map((k) => (
            <li key={k}>{t(`app.aboutDoes.${k}`)}</li>
          ))}
        </ul>

        <h3 className="mt-6 text-section-title font-semibold">{t('app.aboutWho')}</h3>
        <ul className="mt-2 flex flex-col gap-3">
          {WHO.map(({ key, icon: Icon }) => (
            <li key={key} className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-tile bg-surface-3 text-ink">
                <Icon size={20} aria-hidden />
              </span>
              <span>
                <span className="block font-semibold">{t(`app.aboutRoles.${key}.name`)}</span>
                <span className="block text-ink-2">{t(`app.aboutRoles.${key}.text`)}</span>
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-6 flex items-center gap-2 text-label text-ink-3">
          <UserRound size={16} aria-hidden />
          {t('app.aboutTeam')}
        </p>
        <PlainButton className="mt-4 w-full" onClick={() => onOpenChange(false)}>
          {t('shell.close')}
        </PlainButton>
      </DialogContent>
    </Dialog>
  )
}
