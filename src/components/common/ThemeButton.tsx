import { Moon, Sun } from 'lucide-react'
import { useLang } from '@/lib/i18n'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/cn'

/** Light / Dark switch: shows the theme you will switch to. */
export function ThemeButton({ className }: { className?: string }) {
  const { t } = useLang()
  const { theme, toggle } = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'
  const Icon = next === 'dark' ? Moon : Sun
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t(`theme.switchTo.${next}`)}
      title={t(`theme.switchTo.${next}`)}
      className={cn(
        'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-line-strong px-3 text-[15px] font-semibold text-ink',
        'transition-colors duration-200 hover:bg-surface-3',
        className,
      )}
    >
      <Icon size={18} aria-hidden />
      <span className="hidden sm:inline">{t(`theme.${next}`)}</span>
    </button>
  )
}
