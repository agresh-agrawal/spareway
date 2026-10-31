import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Bell, Download, Gauge, Info, LogOut, Settings } from 'lucide-react'
import { IconButton, LanguageButton } from '@/components/common'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/app/auth/AuthProvider'
import { useLang } from '@/lib/i18n'
import { useLowData } from '@/lib/lowData'
import { useInstall } from '@/features/offline'
import { useOpenAlertCount } from './api'
import { SearchBox } from './SearchBox'
import { AboutDialog } from './AboutDialog'

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || 'S'
  )
}

/** Title · search · Hindi button · bell with problem count · avatar menu. */
export function TopBar({ title }: { title: string }) {
  const { t } = useLang()
  const nav = useNavigate()
  const { profile, company, signOut } = useAuth()
  const { lowData, setLowData } = useLowData()
  const { canInstall, install } = useInstall()
  const { data: count = 0 } = useOpenAlertCount()
  const [about, setAbout] = useState(false)

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur lg:border-none lg:bg-canvas/80">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:h-20">
        <img src="/brand/spareway-mark.svg" alt="" className="size-9 rounded-[10px] lg:hidden" />
        <h1 className="min-w-0 flex-1 truncate text-[20px] font-semibold sm:text-[22px] lg:text-page-title">{title}</h1>
        <div className="hidden md:block">
          <SearchBox />
        </div>
        <LanguageButton />
        <IconButton
          icon={Bell}
          label={t('shell.problemsCount', { count })}
          badge={count}
          onClick={() => nav('/#problems')}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label={t('shell.account')}
              className="hidden size-12 shrink-0 items-center justify-center rounded-full border border-line bg-surface-3 font-semibold text-ink sm:flex"
            >
              {initials(profile?.full_name ?? '')}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              <span className="block font-semibold text-ink">{profile?.full_name}</span>
              <span className="block truncate">{company?.name}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              <Gauge size={20} className="text-ink-2" />
              <span className="flex-1">{t('shell.lowData')}</span>
              <Switch checked={lowData} onCheckedChange={setLowData} aria-label={t('shell.lowData')} />
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => nav('/settings')}>
              <Settings size={20} className="text-ink-2" />
              {t('nav.settings')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setAbout(true)}>
              <Info size={20} className="text-ink-2" />
              {t('app.about')}
            </DropdownMenuItem>
            {canInstall && (
              <DropdownMenuItem onSelect={() => void install()}>
                <Download size={20} className="text-ink-2" />
                {t('offline:install')}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void signOut()} className="text-crit">
              <LogOut size={20} />
              {t('shell.logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="px-4 pb-3 md:hidden">
        <SearchBox />
      </div>
      <AboutDialog open={about} onOpenChange={setAbout} />
    </header>
  )
}
