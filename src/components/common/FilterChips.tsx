import { cn } from '@/lib/cn'

export interface FilterChip<V extends string> {
  value: V
  label: string
  count?: number
}

/** Row of filter chips with counts (Trucks, Trips, Loads). Scrolls sideways on phone. */
export function FilterChips<V extends string>({
  chips,
  value,
  onChange,
  label,
}: {
  chips: FilterChip<V>[]
  value: V
  onChange: (v: V) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      {chips.map((c) => {
        const on = c.value === value
        return (
          <button
            key={c.value}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(c.value)}
            className={cn(
              'inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-[15px] font-semibold whitespace-nowrap transition-colors duration-200',
              on ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong bg-surface-2 text-ink-2 hover:text-ink',
            )}
          >
            {c.label}
            {c.count !== undefined && (
              <span className={cn('rounded-full px-1.5 text-[13px] tabular', on ? 'bg-accent-ink/15' : 'bg-surface-3')}>{c.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
