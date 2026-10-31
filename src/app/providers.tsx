import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { LowDataProvider } from '@/lib/lowData'
import { AppError } from '@/lib/errors'
import { STALE_TIME_MS } from '@/lib/queryKeys'
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

export function Providers({ children }: { children: ReactNode }) {
  const [qc] = useState(makeQueryClient)
  return (
    <QueryClientProvider client={qc}>
      <LowDataProvider>
        <TooltipProvider>
          <AuthProvider>{children}</AuthProvider>
          <Toaster
            theme="dark"
            position="bottom-center"
            toastOptions={{
              style: { background: '#232327', border: '1px solid rgba(255,255,255,0.12)', color: '#f2f2f3', fontSize: 15 },
            }}
          />
        </TooltipProvider>
      </LowDataProvider>
    </QueryClientProvider>
  )
}
