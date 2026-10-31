import { useMemo } from 'react'
import { RouterProvider } from 'react-router'
import { Settings2 } from 'lucide-react'
import { FullScreenMessage } from '@/components/common'
import { readEnv } from '@/lib/env'
import { isFixtureMode } from '@/lib/fixtures'
import { useLang } from '@/lib/i18n'
import { getModules } from './modules'
import { Providers } from './providers'
import { createAppRouter } from './router'

function MissingEnv({ names }: { names: string[] }) {
  const { t } = useLang()
  return <FullScreenMessage icon={Settings2} title={t('app.missingEnvTitle')} text={t('app.missingEnvText', { names: names.join(', ') })} />
}

export function App() {
  const { env, missing } = readEnv()
  // fixture mode (dev only) needs no Supabase settings
  const ok = Boolean(env) || isFixtureMode()
  const router = useMemo(() => (ok ? createAppRouter(getModules()) : null), [ok])
  if (!ok || !router) return <MissingEnv names={missing} />
  return (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  )
}
