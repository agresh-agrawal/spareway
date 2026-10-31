import { lazy } from 'react'
import type { FeatureModule } from '@/types/domain'
import en from './i18n/en.json'
import hi from './i18n/hi.json'

const DriverLinkButton = lazy(() => import('./components/DriverLinkButton').then((m) => ({ default: m.DriverLinkButton })))

/** Driver link (Pre-Phase 4): owner shares /drive/:token by QR or WhatsApp; the driver needs no login. */
const driver: FeatureModule = {
  id: 'driver',
  order: 34,
  i18n: { en, hi },
  publicRoutes: [{ path: '/drive/:token', element: lazy(() => import('./pages/DriverPage')), guard: 'none' }],
  slots: {
    'trip.actions': [{ id: 'driver-link', order: 5, component: DriverLinkButton }],
  },
}

export default driver
