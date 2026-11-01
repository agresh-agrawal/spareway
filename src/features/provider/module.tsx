import { lazy } from 'react'
import { Megaphone } from 'lucide-react'
import type { FeatureModule } from '@/types/domain'
import en from './i18n/en.json'
import hi from './i18n/hi.json'

const ProviderAction = lazy(() =>
  import('./components/OwnerTools').then((m) => ({ default: m.ProviderAction })),
)

/** Load providers (stage 5): no-login posting link, a page per load with counter-offers. */
const provider: FeatureModule = {
  id: 'provider',
  order: 42,
  i18n: { en, hi },
  publicRoutes: [
    { path: '/post/:token', element: lazy(() => import('./pages/ProviderPostPage')), guard: 'none' },
    { path: '/offer/:share', element: lazy(() => import('./pages/SharedLoadPage')), guard: 'none' },
    { path: '/my-loads/:portal', element: lazy(() => import('./pages/PortalPage')), guard: 'none' },
  ],
  slots: {
    'home.actions': [
      {
        id: 'provider-link',
        order: 45,
        component: ProviderAction,
        labelKey: 'provider:owner.getLoads',
        icon: Megaphone,
      },
    ],
  },
}

export default provider
