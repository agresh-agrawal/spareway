import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthContext } from '@/app/auth/AuthProvider'
import { setupI18n } from '@/i18n/setup'
import { getModules } from '@/app/modules'
import type { UseAuth } from '@/types/domain'

setupI18n('en')
getModules() // registers feature namespaces

export function fakeAuth(over: Partial<UseAuth> = {}): UseAuth {
  const noop = async () => {}
  return {
    session: null,
    user: null,
    profile: null,
    company: null,
    settings: null,
    status: 'signedOut',
    error: null,
    signInWithPassword: noop,
    signUp: async () => ({ needsConfirmation: true }),
    signInWithGoogle: noop,
    sendPasswordReset: noop,
    updatePassword: noop,
    resendConfirmation: noop,
    signOut: noop,
    refreshProfile: noop,
    ...over,
  }
}

/** Render `ui` at `path` inside a router; other paths render their name so redirects can be asserted. */
export function renderAt(ui: ReactElement, { path, at, auth }: { path: string; at: string; auth: UseAuth }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[at]}>
          <Routes>
            <Route path={path} element={ui} />
            <Route path="/login" element={<LocationProbe name="login" />} />
            <Route path="/" element={<LocationProbe name="home" />} />
            <Route path="/trips" element={<LocationProbe name="trips" />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

import { useLocation } from 'react-router'
function LocationProbe({ name }: { name: string }) {
  const loc = useLocation()
  return <div data-testid="at">{`${name}${loc.search}`}</div>
}
