import { useMatches, Outlet } from 'react-router'
import { useEffect } from 'react'
import { getModules, buildNav } from '@/app/modules'
import { useLang } from '@/lib/i18n'
import { Rail } from './Rail'
import { BottomTabs } from './BottomTabs'
import { TopBar } from './TopBar'
import { FixtureBanner } from './FixtureBanner'

export function usePageTitle(): string {
  const matches = useMatches()
  const { t } = useLang()
  const handle = [...matches].reverse().find((m) => (m.handle as { titleKey?: string } | undefined)?.titleKey)
  const key = (handle?.handle as { titleKey?: string } | undefined)?.titleKey
  return key ? t(key) : t('app.name')
}

/** Laptop: floating icon rail + top bar. Phone: top bar + bottom tabs. */
export function AppShell() {
  const nav = buildNav(getModules())
  const title = usePageTitle()
  useEffect(() => {
    document.title = title === 'Spareway' ? 'Spareway' : `${title} · Spareway`
  }, [title])

  return (
    <div className="min-h-dvh bg-canvas">
      <Rail items={nav} />
      <div className="lg:pl-[104px]">
        <FixtureBanner />
        <TopBar title={title} />
        <main className="mx-auto w-full max-w-[1440px] px-4 pt-2 pb-28 sm:px-6 lg:pb-10">
          <Outlet />
        </main>
      </div>
      <BottomTabs items={nav} />
    </div>
  )
}
