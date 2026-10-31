import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Route as RouteIcon, Search, Truck } from 'lucide-react'
import { TripStatusChip, TruckStatusChip } from '@/components/common'
import { useLang } from '@/lib/i18n'
import { useShellSearch } from './api'

/** Trucks by number, trips by code — results as a simple list. */
export function SearchBox() {
  const { t } = useLang()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const { data, isFetching } = useShellSearch(q)

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const go = (path: string) => {
    setOpen(false)
    setQ('')
    nav(path)
  }
  const show = open && q.trim().length >= 2
  const empty = data && data.trucks.length === 0 && data.trips.length === 0

  return (
    <div ref={box} className="relative w-full md:w-72">
      <Search size={20} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-3" aria-hidden />
      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        placeholder={t('shell.search')}
        aria-label={t('shell.search')}
        className="h-12 w-full rounded-full border border-line bg-surface-2 pr-4 pl-11 text-[16px] placeholder:text-ink-3 focus:border-accent focus:outline-none"
      />
      {show && (
        <div className="absolute inset-x-0 top-14 z-40 rounded-tile border border-line-strong bg-surface-2 p-1.5 shadow-2xl">
          {isFetching && !data && <p className="p-3 text-ink-2">{t('app.loading')}</p>}
          {empty && <p className="p-3 text-ink-2">{t('shell.searchNoResults')}</p>}
          {data?.trucks.map((tr) => (
            <button key={tr.id} onClick={() => go(`/trucks/${tr.id}`)} className="flex min-h-12 w-full items-center gap-3 rounded-[10px] px-3 text-left hover:bg-surface-3">
              <Truck size={20} className="text-ink-2" aria-hidden />
              <span className="flex-1 font-medium">{tr.reg_no}</span>
              <TruckStatusChip status={tr.status} />
            </button>
          ))}
          {data?.trips.map((tp) => (
            <button key={tp.id} onClick={() => go(`/trips/${tp.id}`)} className="flex min-h-12 w-full items-center gap-3 rounded-[10px] px-3 text-left hover:bg-surface-3">
              <RouteIcon size={20} className="text-ink-2" aria-hidden />
              <span className="flex-1 font-medium">{tp.code}</span>
              <TripStatusChip status={tp.status} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
