import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

interface BaseProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: LucideIcon
  loading?: boolean
  children?: ReactNode
}

/** The one lime button per view: 52 px, icon + word. Loading keeps its width. */
export const MainButton = forwardRef<HTMLButtonElement, BaseProps & { size?: 'md' | 'lg' }>(function MainButton(
  { icon: Icon, loading, children, className, disabled, size = 'md', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'relative inline-flex items-center justify-center gap-2 rounded-control bg-accent px-5 text-button font-semibold text-accent-ink',
        'transition-[filter,opacity] duration-200 hover:brightness-95 active:brightness-90 disabled:opacity-60',
        size === 'lg' ? 'h-14 text-[20px]' : 'h-[52px]',
        className,
      )}
      {...props}
    >
      <span className={cn('inline-flex items-center gap-2', loading && 'invisible')}>
        {Icon && <Icon size={20} aria-hidden />}
        {children}
      </span>
      {loading && <Loader2 size={20} className="absolute animate-spin" aria-label="Loading" />}
    </button>
  )
})

/** Outlined 48 px button with icon + word. */
export const PlainButton = forwardRef<HTMLButtonElement, BaseProps & { tone?: 'default' | 'danger' }>(
  function PlainButton({ icon: Icon, loading, children, className, disabled, tone = 'default', ...props }, ref) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'relative inline-flex h-12 items-center justify-center gap-2 rounded-control border border-line-strong bg-surface-2 px-4 text-button font-semibold',
          'transition-colors duration-200 hover:bg-surface-3 disabled:opacity-60',
          tone === 'danger' ? 'text-crit' : 'text-ink',
          className,
        )}
        {...props}
      >
        <span className={cn('inline-flex items-center gap-2', loading && 'invisible')}>
          {Icon && <Icon size={20} aria-hidden />}
          {children}
        </span>
        {loading && <Loader2 size={20} className="absolute animate-spin" aria-label="Loading" />}
      </button>
    )
  },
)

/** 48 px round button. Always has a label for screen readers. */
export const IconButton = forwardRef<HTMLButtonElement, BaseProps & { label: string; badge?: number }>(
  function IconButton({ icon: Icon, label, badge, className, ...props }, ref) {
    return (
      <button
        ref={ref}
        aria-label={label}
        title={label}
        className={cn(
          'relative inline-flex size-12 shrink-0 items-center justify-center rounded-full border border-line bg-surface-2 text-ink',
          'transition-colors duration-200 hover:bg-surface-3',
          className,
        )}
        {...props}
      >
        {Icon && <Icon size={20} aria-hidden />}
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-crit px-1 text-[12px] font-semibold text-white tabular">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </button>
    )
  },
)

/** White "Continue with Google" button. */
export function GoogleButton({ children, loading, className, ...props }: BaseProps) {
  return (
    <button
      disabled={props.disabled || loading}
      className={cn(
        'relative inline-flex h-12 w-full items-center justify-center gap-3 rounded-control bg-white px-4 text-button font-semibold text-[#1f1f1f]',
        'transition-[filter] duration-200 hover:brightness-95 disabled:opacity-60',
        className,
      )}
      {...props}
    >
      <span className={cn('inline-flex items-center gap-3', loading && 'invisible')}>
        <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
        {children}
      </span>
      {loading && <Loader2 size={20} className="absolute animate-spin" aria-label="Loading" />}
    </button>
  )
}
