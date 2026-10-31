import { NavLink } from 'react-router'
import type { NavItem } from '@/types/domain'
import { useLang } from '@/lib/i18n'
import { cn } from '@/lib/cn'

type Item = NavItem & { id: string }

/** Floating rail with an icon and its name for every page (laptop ≥ 1024 px). Settings at the bottom. */
export function Rail({ items }: { items: Item[] }) {
  const { t } = useLang()
  const main = items.filter((i) => i.id !== 'settings')
  const bottom = items.filter((i) => i.id === 'settings')
  const link = (i: Item) => (
    <NavLink
      key={i.id}
      to={i.path}
      end={i.path === '/'}
      className={({ isActive }) =>
        cn(
          'flex w-[76px] flex-col items-center gap-1 rounded-tile px-1 py-2 text-center text-[13px] leading-4 font-semibold transition-colors duration-200',
          isActive ? 'bg-ink text-canvas' : 'text-ink-2 hover:bg-surface-3 hover:text-ink',
        )
      }
    >
      <i.icon size={22} aria-hidden />
      <span className="w-full truncate">{t(i.labelKey)}</span>
    </NavLink>
  )
  return (
    <aside className="fixed inset-y-4 left-4 z-30 hidden w-[92px] flex-col items-center rounded-[28px] border border-line bg-rail py-4 shadow-sm lg:flex">
      <img src="/brand/spareway-mark.svg" alt="Spareway" className="mb-6 size-10 rounded-[12px]" />
      <nav className="flex flex-1 flex-col items-center gap-1.5 overflow-y-auto scrollbar-none">{main.map(link)}</nav>
      <nav className="flex flex-col items-center gap-1.5">{bottom.map(link)}</nav>
    </aside>
  )
}
