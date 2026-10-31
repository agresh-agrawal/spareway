import type { ReactNode } from 'react'
import { LanguageButton, Logo, ThemeButton } from '@/components/common'

/** No-login page frame for load providers: logo, theme and language, a phone-width column. */
export function PublicFrame({ children, title, sub }: { children: ReactNode; title?: string; sub?: string }) {
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex max-w-[640px] items-center justify-between gap-3 px-4 py-3">
          {title ? (
            <div className="min-w-0">
              <div className="truncate text-[20px] leading-6 font-semibold">{title}</div>
              {sub && <div className="truncate text-label text-ink-2">{sub}</div>}
            </div>
          ) : (
            <Logo />
          )}
          <div className="flex shrink-0 items-center gap-2">
            <ThemeButton />
            <LanguageButton />
          </div>
        </div>
      </header>
      <main className="mx-auto flex max-w-[640px] flex-col gap-4 px-4 pt-4 pb-28">{children}</main>
    </div>
  )
}
