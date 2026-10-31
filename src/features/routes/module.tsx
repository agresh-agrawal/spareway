import { lazy } from 'react'
import { Route } from 'lucide-react'
import type { FeatureModule } from '@/types/domain'
import en from './i18n/en.json'
import hi from './i18n/hi.json'
import { tripHasRoute } from './lib/stepState'

// lazy so the map and route logic load with the step, not with the app
const RouteStep = lazy(() => import('./components/RouteStep').then((m) => ({ default: m.RouteStep })))

const routes: FeatureModule = {
  id: 'routes',
  order: 26,
  i18n: { en, hi },
  slots: {
    'trip.steps': [
      { id: 'route', order: 4, component: RouteStep, labelKey: 'routes:step', icon: Route, done: ({ tripId }) => tripHasRoute(tripId) },
    ],
  },
}

export default routes
