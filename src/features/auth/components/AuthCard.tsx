import type { ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'
import { LanguageButton, Logo } from '@/components/common'

/** No shell; centred card 420 px; logo; Hindi button top-right. */
export function AuthCard({ title, children, footer }: { title: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <div className="flex items-center justify-between p-4 sm:p-6">
        <Logo />
        <LanguageButton />
      </div>
      <div className="flex flex-1 items-start justify-center px-4 pb-10 sm:items-center">
        <div className="w-full max-w-[420px] rounded-card border border-line bg-surface p-5 sm:p-7">
          <h1 className="mb-6 text-[22px] leading-7 font-semibold">{title}</h1>
          {children}
        </div>
      </div>
      {footer}
    </div>
  )
}

export function FormError({ children }: { children?: ReactNode }) {
  if (!children) return null
  return (
    <p role="alert" className="flex items-start gap-2 rounded-tile border border-crit/40 bg-crit/[0.08] p-3 text-crit">
      <AlertCircle size={20} className="mt-0.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  )
}

export function OrDivider({ label }: { label: string }) {
  return (
    <div className="my-5 flex items-center gap-3 text-label text-ink-3">
      <span className="h-px flex-1 bg-line-strong" />
      {label}
      <span className="h-px flex-1 bg-line-strong" />
    </div>
  )
}
