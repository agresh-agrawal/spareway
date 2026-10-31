import { Link } from 'react-router'
import type { LucideIcon } from 'lucide-react'

/** Big icon + word tile for the home.actions slot (2 per row on phone). */
export function QuickAction({ to, icon: Icon, label }: { to: string; icon: LucideIcon; label: string }) {
  return (
    <Link
      to={to}
      className="flex min-h-14 items-center gap-3 rounded-tile border border-line bg-surface-2 px-4 py-3 font-semibold transition-colors duration-200 hover:bg-surface-3"
    >
      <Icon size={22} className="shrink-0 text-accent" aria-hidden />
      <span className="min-w-0">{label}</span>
    </Link>
  )
}
