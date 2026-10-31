import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router'
import { Gauge, LogOut, Menu } from 'lucide-react'
import type { NavItem } from '@/types/domain'
import { Sheet } from '@/components/common/Sheet'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/app/auth/AuthProvider'
import { useLang } from '@/lib/i18n'
import { useLowData } from '@/lib/lowData'
import { cn } from '@/lib/cn'

type Item = NavItem & { id: string }

/** Phone (< 1024 px): Home · Trucks · Trips · Map · More (Loads, Earnings, Settings, Low-data, Log out). */
export function BottomTabs({ items }: { items: Item[] }) {
  const { t } = useLang()
  const nav = useNavigate()
  const { signOut } = useAuth()
  const { lowData, setLowData } = useLowData()
  const [more, setMore] = useState(false)
  const tabs = items.filter((i) => i.phone === 'tab')
  const moreItems = items.filter((i) => i.phone === 'more')

  const tabCls = (active: boolean) =>
    cn(
      'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[12px] font-medium leading-4',
      active ? 'text-accent' : 'text-ink-2',
    )

  return (
    <>
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-rail/95 backdrop-blur lg:hidden">
        <div className="mx-auto flex h-16 max-w-xl">
          {tabs.map((i) => (
            <NavLink key={i.id} to={i.path} end={i.path === '/'} className={({ isActive }) => tabCls(isActive)}>
              <i.icon size={22} aria-hidden />
              <span className="max-w-full truncate px-1">{t(i.labelKey)}</span>
            </NavLink>
          ))}
          <button onClick={() => setMore(true)} className={tabCls(false)}>
            <Menu size={22} aria-hidden />
            <span>{t('nav.more')}</span>
          </button>
        </div>
      </nav>
      <Sheet open={more} onOpenChange={setMore} title={t('nav.more')}>
        <div className="flex flex-col gap-2">
          {moreItems.map((i) => (
            <button
              key={i.id}
              onClick={() => {
                setMore(false)
                nav(i.path)
              }}
              className="flex min-h-14 items-center gap-3 rounded-tile border border-line bg-surface-2 px-4 text-left font-medium hover:bg-surface-3"
            >
              <i.icon size={22} className="text-ink-2" aria-hidden />
              {t(i.labelKey)}
            </button>
          ))}
          <label className="flex min-h-14 items-center gap-3 rounded-tile border border-line bg-surface-2 px-4">
            <Gauge size={22} className="text-ink-2" aria-hidden />
            <span className="flex-1">
              <span className="block font-medium">{t('shell.lowData')}</span>
              <span className="block text-label text-ink-3">{t('shell.lowDataHelp')}</span>
            </span>
            <Switch checked={lowData} onCheckedChange={setLowData} aria-label={t('shell.lowData')} />
          </label>
          <button
            onClick={() => void signOut()}
            className="flex min-h-14 items-center gap-3 rounded-tile border border-line bg-surface-2 px-4 text-left font-medium text-crit hover:bg-surface-3"
          >
            <LogOut size={22} aria-hidden />
            {t('shell.logout')}
          </button>
        </div>
      </Sheet>
    </>
  )
}
