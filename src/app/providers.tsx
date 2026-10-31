import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { useState, type ReactNode } from 'react'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { LowDataProvider } from '@/lib/lowData'
import { AppError } from '@/lib/errors'
import { STALE_TIME_MS } from '@/lib/queryKeys'
import { isFixtureMode } from '@/lib/fixtures'
import { useTheme } from '@/lib/theme'
import { OfflineLayer, persistOptions } from '@/features/offline'
import { AuthProvider } from './auth/AuthProvider'

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME_MS,
        refetchOnWindowFocus: true,
        // retry 1, but never for 4xx-type app errors
        retry: (count, err) => {
          if (err instanceof AppError && err.code !== 'NETWORK' && err.code !== 'UNKNOWN') return false
          return count < 1
        },
      },
    },
  })
}

function ThemedToaster() {
  const { theme } = useTheme()
  return (
    <Toaster
      theme={theme}
      position="bottom-center"
      toastOptions={{
        style: { background: 'var(--color-surface-3)', border: '1px solid var(--color-line-strong)', color: 'var(--color-ink)', fontSize: 16 },
      }}
    />
  )
}

export function Providers({ children }: { children: ReactNode }) {
  const [qc] = useState(makeQueryClient)
  // saved data for offline use (Phase 4·Code F21); fixture mode keeps its sample store in memory only
  const [persist] = useState(() => !isFixtureMode())
  const inner = (
    <LowDataProvider>
      <TooltipProvider>
        <AuthProvider>{children}</AuthProvider>
        <OfflineLayer />
        <ThemedToaster />
      </TooltipProvider>
    </LowDataProvider>
  )
  return persist ? (
    <PersistQueryClientProvider client={qc} persistOptions={persistOptions}>
      {inner}
    </PersistQueryClientProvider>
  ) : (
    <QueryClientProvider client={qc}>{inner}</QueryClientProvider>
  )
}
