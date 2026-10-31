import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { LogIn } from 'lucide-react'
import { FullScreenMessage, MainButton } from '@/components/common'
import { useAuth } from '@/app/auth/AuthProvider'
import { safeNext } from '@/app/auth/guards'
import { getSupabase } from '@/lib/supabase'
import { useLang } from '@/lib/i18n'

/** "Signing you in…": supabase-js (detectSessionInUrl, PKCE) exchanges the code; then go to next or Home. */
export default function AuthCallbackPage() {
  const { t } = useLang('auth')
  const nav = useNavigate()
  const { status } = useAuth()
  const [problem, setProblem] = useState<string | null>(null)
  const search = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.slice(1))
  const next = safeNext(search.get('next'))
  const errorDescription = search.get('error_description') ?? hash.get('error_description')
  const errorCode = search.get('error') ?? hash.get('error')

  useEffect(() => {
    if (errorDescription || errorCode) return
    const code = search.get('code')
    if (!code) return
    // detectSessionInUrl usually finishes this; exchange again only if no session appeared
    const id = setTimeout(async () => {
      const { data } = await getSupabase().auth.getSession()
      if (data.session) return
      const { error } = await getSupabase().auth.exchangeCodeForSession(code)
      if (error) setProblem(error.message)
    }, 1500)
    return () => clearTimeout(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (errorCode === 'access_denied') return <Navigate to="/login?error=google_cancelled" replace />
  if (status === 'ready' || status === 'preparing') return <Navigate to={next} replace />

  const failed = errorDescription || problem
  if (failed)
    return (
      <FullScreenMessage
        title={t('callbackFailed')}
        text={failed}
        action={
          <MainButton icon={LogIn} onClick={() => nav('/login', { replace: true })}>
            {t('backToLogin')}
          </MainButton>
        }
      />
    )
  return <FullScreenMessage spinning title={t('signingIn')} />
}
