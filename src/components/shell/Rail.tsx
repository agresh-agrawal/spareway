import { NavLink } from 'react-router'
import type { NavItem } from '@/types/domain'
import { Tooltip } from '@/components/ui/tooltip'
import { useLang } from '@/lib/i18n'
import { cn } from '@/lib/cn'

type Item = NavItem & { id: string }

/** Floating 64 px icon rail with labels on hover (laptop ≥ 1024 px). Settings at the bottom. */
export function Rail({ items }: { items: Item[] }) {
  const { t } = useLang()
  const main = items.filter((i) => i.id !== 'settings')
  const bottom = items.filter((i) => i.id === 'settings')
  const link = (i: Item) => (
    <Tooltip key={i.id} label={t(i.labelKey)}>
      <NavLink
        to={i.path}
        end={i.path === '/'}
        aria-label={t(i.labelKey)}
        className={({ isActive }) =>
          cn(
            'flex size-12 items-center justify-center rounded-full transition-colors duration-200',
            isActive ? 'bg-ink text-canvas' : 'text-ink-2 hover:bg-surface-3 hover:text-ink',
          )
        }
      >
        <i.icon size={20} aria-hidden />
      </NavLink>
    </Tooltip>
  )
  return (
    <aside className="fixed inset-y-5 left-5 z-30 hidden w-16 flex-col items-center rounded-[32px] border border-line bg-rail py-4 lg:flex">
      <img src="/brand/spareway-mark.svg" alt="Spareway" className="mb-6 size-10 rounded-[12px]" />
      <nav className="flex flex-1 flex-col items-center gap-2">{main.map(link)}</nav>
      <nav className="flex flex-col items-center gap-2">{bottom.map(link)}</nav>
    </aside>
  )
}
