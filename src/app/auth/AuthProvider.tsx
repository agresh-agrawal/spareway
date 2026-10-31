import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { getSupabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import { applyLang, currentLang, setLangPersister } from '@/lib/i18n'
import type { AuthStatus, ErrorCode, Lang, UseAuth } from '@/types/domain'
import { exitFixtureMode, fixtureStore, isFixtureMode } from '@/lib/fixtures'
import { fetchMe, savePreferredLang, seedSampleData, type Me } from './api'

const AuthCtx = createContext<UseAuth | null>(null)

const origin = () => window.location.origin

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [sessionKnown, setSessionKnown] = useState(false)
  const [me, setMe] = useState<Me | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [error, setError] = useState<{ code: ErrorCode; message: string } | null>(null)
  const loadedFor = useRef<string | null>(null)

  // 1. session: initial + every change (never call supabase inside the callback itself)
  useEffect(() => {
    if (isFixtureMode()) {
      // dev fixture mode: a fake signed-in owner, no Supabase
      const d = fixtureStore()
      setSession({
        access_token: 'fixture',
        refresh_token: 'fixture',
        token_type: 'bearer',
        expires_in: 3600,
        user: { id: d.profile.id, email: d.profile.email, app_metadata: { provider: 'email' }, user_metadata: {}, aud: 'authenticated', created_at: d.profile.created_at },
      } as Session)
      setSessionKnown(true)
      return
    }
    const sb = getSupabase()
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionKnown(true)
    })
    const { data } = sb.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setSessionKnown(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  // 2. profile + first-login demo data
  const bootstrap = useCallback(async (s: Session) => {
    setError(null)
    if (isFixtureMode()) {
      const d = fixtureStore()
      setMe({ profile: d.profile, company: d.company, settings: d.settings })
      setStatus('ready')
      return
    }
    try {
      let next = await fetchMe(s.user.id)
      if (!next.company.sample_seeded_at) {
        setStatus('preparing')
        await seedSampleData()
        next = await fetchMe(s.user.id)
        // first login: keep the language chosen on the sign-up page
        const deviceLang = currentLang()
        if (deviceLang !== next.profile.preferred_lang) {
          await savePreferredLang(s.user.id, deviceLang).catch(() => {})
          next = { ...next, profile: { ...next.profile, preferred_lang: deviceLang } }
        }
      }
      setMe(next)
      applyLang(next.profile.preferred_lang === 'hi' ? 'hi' : 'en', false)
      setStatus('ready')
    } catch (e) {
      const err = toAppError(e)
      setError({ code: err.code, message: err.message })
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    if (!sessionKnown) return
    if (!session) {
      loadedFor.current = null
      setMe(null)
      setStatus('signedOut')
      return
    }
    if (loadedFor.current === session.user.id) return
    loadedFor.current = session.user.id
    setStatus('loading')
    void bootstrap(session)
  }, [session, sessionKnown, bootstrap])

  // 3. language choice → profile
  useEffect(() => {
    const uid = session?.user.id
    if (!uid || status !== 'ready') {
      setLangPersister(null)
      return
    }
    setLangPersister((lang: Lang) => {
      setMe((m) => (m ? { ...m, profile: { ...m.profile, preferred_lang: lang } } : m))
      savePreferredLang(uid, lang).catch(() => {})
    })
    return () => setLangPersister(null)
  }, [session?.user.id, status])

  const value = useMemo<UseAuth>(() => {
    const sb = () => getSupabase().auth
    const fail = (e: unknown): never => {
      throw toAppError(e)
    }
    return {
      session,
      user: session?.user ?? null,
      profile: me?.profile ?? null,
      company: me?.company ?? null,
      settings: me?.settings ?? null,
      status,
      error,
      async signInWithPassword(email, password) {
        const { error: e } = await sb().signInWithPassword({ email, password })
        if (e) fail(e)
      },
      async signUp({ fullName, companyName, email, password }) {
        const { data, error: e } = await sb().signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, company_name: companyName },
            emailRedirectTo: `${origin()}/auth/callback`,
          },
        })
        if (e) fail(e)
        // existing confirmed email: Supabase returns a user with no identities
        if (data.user && data.user.identities && data.user.identities.length === 0) fail({ code: 'user_already_exists', message: 'EMAIL_TAKEN' })
        return { needsConfirmation: !data.session }
      },
      async signInWithGoogle(next) {
        const redirectTo = `${origin()}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ''}`
        const { error: e } = await sb().signInWithOAuth({ provider: 'google', options: { redirectTo } })
        if (e) fail(e)
      },
      async sendPasswordReset(email) {
        const { error: e } = await sb().resetPasswordForEmail(email, { redirectTo: `${origin()}/reset-password` })
        // never reveal whether the email exists: only rate limits / network surface
        if (e) {
          const err = toAppError(e)
          if (err.code === 'RATE_LIMITED' || err.code === 'NETWORK') throw err
        }
      },
      async updatePassword(pw) {
        const { error: e } = await sb().updateUser({ password: pw })
        if (e) fail(e)
      },
      async resendConfirmation(email) {
        const { error: e } = await sb().resend({
          type: 'signup',
          email,
          options: { emailRedirectTo: `${origin()}/auth/callback` },
        })
        if (e) fail(e)
      },
      async signOut() {
        if (isFixtureMode()) {
          exitFixtureMode()
          window.location.assign('/login')
          return
        }
        await sb().signOut()
        qc.clear()
        setLangPersister(null)
      },
      async refreshProfile() {
        if (!session) return
        if (isFixtureMode()) {
          const d = fixtureStore()
          setMe({ profile: d.profile, company: d.company, settings: d.settings })
          return
        }
        try {
          setMe(await fetchMe(session.user.id))
        } catch (e) {
          const err = toAppError(e)
          setError({ code: err.code, message: err.message })
        }
      },
    }
  }, [session, me, status, error, qc])

  // retry after an error (bootstrap again)
  const retryValue = useMemo(
    () => ({
      ...value,
      async refreshProfile() {
        if (status === 'error' && session) {
          loadedFor.current = session.user.id
          setStatus('loading')
          await bootstrap(session)
          return
        }
        await value.refreshProfile()
      },
    }),
    [value, status, session, bootstrap],
  )

  return <AuthCtx.Provider value={retryValue}>{children}</AuthCtx.Provider>
}

export function useAuth(): UseAuth {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}

/** For tests: provide a fixed auth value. */
export const AuthContext = AuthCtx
