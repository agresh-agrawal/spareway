import { Check, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface StepTab {
  id: string
  label: string
  icon?: LucideIcon
  done?: boolean
}

/** Numbered tabs with icon + word, ✓ when done, current underlined lime. Scrolls on phone. */
export function StepTabs({ steps, current, onChange }: { steps: StepTab[]; current: string; onChange: (id: string) => void }) {
  return (
    <div role="tablist" className="scrollbar-none -mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
      {steps.map((s, i) => {
        const active = s.id === current
        const Icon = s.icon
        return (
          <button
            key={s.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(s.id)}
            className={cn(
              'relative flex h-12 shrink-0 items-center gap-2 px-3 text-[15px] font-semibold whitespace-nowrap transition-colors duration-200',
              active ? 'text-ink' : 'text-ink-2 hover:text-ink',
            )}
          >
            <span
              className={cn(
                'flex size-6 items-center justify-center rounded-full text-[12px] tabular',
                s.done ? 'bg-ok text-accent-ink' : active ? 'bg-accent text-accent-ink' : 'bg-surface-3 text-ink-2',
              )}
            >
              {s.done ? <Check size={14} aria-label="done" /> : i + 1}
            </span>
            {Icon && <Icon size={20} aria-hidden />}
            {s.label}
            {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />}
          </button>
        )
      })}
    </div>
  )
}
