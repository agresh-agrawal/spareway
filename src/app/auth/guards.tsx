import type { ReactNode } from 'react'
import { Navigate, useLocation, useSearchParams } from 'react-router'
import { RotateCcw, LogOut } from 'lucide-react'
import { FullScreenMessage, MainButton, PlainButton } from '@/components/common'
import { useLang } from '@/lib/i18n'
import { useAuth } from './AuthProvider'

/** Only allow same-site relative paths as ?next= */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/'
  return next
}

/** Around the shell: signed out → /login?next=…; first login → "Setting up your demo trucks…". */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, error, refreshProfile, signOut } = useAuth()
  const { t } = useLang('auth')
  const loc = useLocation()

  if (status === 'signedOut') {
    const next = loc.pathname + loc.search
    return <Navigate to={next && next !== '/' ? `/login?next=${encodeURIComponent(next)}` : '/login'} replace />
  }
  if (status === 'preparing') return <FullScreenMessage spinning title={t('auth:preparing')} text={t('auth:preparingText')} />
  if (status === 'loading') return <FullScreenMessage spinning title={t('common:app.loading')} />
  if (status === 'error')
    return (
      <FullScreenMessage
        title={t(`common:errors.${error?.code ?? 'UNKNOWN'}`)}
        text={t('auth:bootError')}
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <MainButton icon={RotateCcw} onClick={() => void refreshProfile()}>
              {t('common:actions.retry')}
            </MainButton>
            <PlainButton icon={LogOut} onClick={() => void signOut()}>
              {t('common:shell.logout')}
            </PlainButton>
          </div>
        }
      />
    )
  return <>{children}</>
}

/** Around login / signup / forgot: already signed in → next or Home. */
export function PublicOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const [params] = useSearchParams()
  if (status === 'ready' || status === 'preparing') return <Navigate to={safeNext(params.get('next'))} replace />
  return <>{children}</>
}
