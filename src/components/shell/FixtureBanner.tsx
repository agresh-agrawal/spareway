import { FlaskConical, X } from 'lucide-react'
import { exitFixtureMode, isFixtureMode } from '@/lib/fixtures'
import { useLang } from '@/lib/i18n'

/** Dev-only strip while ?fixture=seed is on. */
export function FixtureBanner() {
  const { t } = useLang()
  if (!isFixtureMode()) return null
  return (
    <div className="flex items-center gap-2 border-b border-info/30 bg-info/10 px-4 py-1.5 text-label text-info sm:px-6">
      <FlaskConical size={16} aria-hidden />
      <span className="flex-1">{t('fixture.banner')}</span>
      <button
        onClick={() => {
          exitFixtureMode()
          window.location.assign('/login')
        }}
        className="inline-flex min-h-8 items-center gap-1 rounded-full px-2 font-semibold hover:bg-info/15"
      >
        <X size={16} aria-hidden />
        {t('fixture.exit')}
      </button>
    </div>
  )
}
