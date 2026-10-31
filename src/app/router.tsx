import { Suspense, createElement, type ComponentType, type ReactNode } from 'react'
import { createBrowserRouter, isRouteErrorResponse, useRouteError, type RouteObject } from 'react-router'
import { AlertTriangle, Home, RotateCcw } from 'lucide-react'
import { FullScreenMessage, MainButton, PlainButton, SkeletonList } from '@/components/common'
import { AppShell } from '@/components/shell/AppShell'
import { NotFound } from '@/components/shell/NotFound'
import { useLang } from '@/lib/i18n'
import type { FeatureModule } from '@/types/domain'
import { PublicOnly, RequireAuth } from './auth/guards'

/** Error screen per route. */
export function RouteError() {
  const err = useRouteError()
  const { t } = useLang()
  console.error(err)
  if (isRouteErrorResponse(err) && err.status === 404) return <NotFound />
  return (
    <FullScreenMessage
      icon={AlertTriangle}
      title={t('states.error')}
      text={t('errors.UNKNOWN')}
      action={
        <div className="flex flex-col gap-2 sm:flex-row">
          <MainButton icon={RotateCcw} onClick={() => window.location.reload()}>
            {t('actions.retry')}
          </MainButton>
          <PlainButton icon={Home} onClick={() => window.location.assign('/')}>
            {t('shell.goHome')}
          </PlainButton>
        </div>
      }
    />
  )
}

function page(el: ComponentType, fallback: ReactNode) {
  return <Suspense fallback={fallback}>{createElement(el)}</Suspense>
}

/** Pure: modules → route table (shell routes behind RequireAuth, public routes without the shell). */
export function buildRoutes(modules: FeatureModule[]): RouteObject[] {
  const shellChildren: RouteObject[] = modules.flatMap((m) =>
    (m.routes ?? []).map((r) => ({
      path: r.path,
      element: page(r.element, <SkeletonList rows={4} />),
      errorElement: <RouteError />,
      handle: { titleKey: r.titleKey },
    })),
  )
  const publicRoutes: RouteObject[] = modules.flatMap((m) =>
    (m.publicRoutes ?? []).map((r) => {
      const el = page(r.element, <FullScreenMessage spinning title="" />)
      return {
        path: r.path,
        element: r.guard === 'publicOnly' ? <PublicOnly>{el}</PublicOnly> : el,
        errorElement: <RouteError />,
      }
    }),
  )
  return [
    ...publicRoutes,
    {
      element: (
        <RequireAuth>
          <AppShell />
        </RequireAuth>
      ),
      errorElement: <RouteError />,
      children: [...shellChildren, { path: '*', element: <NotFound inShell /> }],
    },
  ]
}

export function createAppRouter(modules: FeatureModule[]) {
  return createBrowserRouter(buildRoutes(modules))
}
