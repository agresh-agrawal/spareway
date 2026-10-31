import { Link } from 'react-router'
import { Truck } from 'lucide-react'

/** Truck number as a small chip linking to the truck page. Truck numbers never change with the language. */
export function TruckChip({ id, regNo, link = true }: { id?: string | null; regNo: string; link?: boolean }) {
  const body = (
    <>
      <Truck size={16} className="text-ink-2" aria-hidden />
      <span className="truncate">{regNo}</span>
    </>
  )
  const cls = 'inline-flex h-8 min-w-0 items-center gap-1.5 rounded-full bg-surface-3 px-3 text-label font-semibold text-ink'
  return link && id ? (
    <Link to={`/trucks/${id}`} className={`${cls} hover:bg-line-strong`}>
      {body}
    </Link>
  ) : (
    <span className={cls}>{body}</span>
  )
}
