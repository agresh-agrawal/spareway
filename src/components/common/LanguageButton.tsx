import { Languages } from 'lucide-react'
import { useLang } from '@/lib/i18n'
import { cn } from '@/lib/cn'

/** Pill showing the language you will switch to: "हिंदी" when English is on, "English" when Hindi is on. */
export function LanguageButton({ className, onToggle }: { className?: string; onToggle?: () => void }) {
  const { t, toggle } = useLang()
  return (
    <button
      type="button"
      onClick={() => (onToggle ? onToggle() : toggle())}
      aria-label={t('lang.switchLabel')}
      className={cn(
        'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-accent/70 px-3.5 text-[15px] font-semibold text-accent',
        'transition-colors duration-200 hover:bg-accent-soft',
        className,
      )}
    >
      <Languages size={18} aria-hidden />
      <span>{t('lang.switchTo')}</span>
    </button>
  )
}
