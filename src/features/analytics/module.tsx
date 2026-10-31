import { lazy } from 'react'
import { IndianRupee } from 'lucide-react'
import type { FeatureModule } from '@/types/domain'
import en from './i18n/en.json'
import hi from './i18n/hi.json'

const EarningsStep = lazy(() => import('./components/EarningsStep').then((m) => ({ default: m.EarningsStep })))
const ThisWeekWidget = lazy(() => import('./components/ThisWeekWidget').then((m) => ({ default: m.ThisWeekWidget })))

const analytics: FeatureModule = {
  id: 'analytics',
  order: 50,
  i18n: { en, hi },
  nav: { labelKey: 'common:nav.earnings', icon: IndianRupee, path: '/earnings', phone: 'more' },
  routes: [{ path: '/earnings', element: lazy(() => import('./pages/EarningsPage')), titleKey: 'analytics:title' }],
  slots: {
    // done: an earning is shown once the trip has a chosen route (costs known)
    'trip.steps': [{ id: 'earnings', order: 6, component: EarningsStep, labelKey: 'analytics:step', icon: IndianRupee }],
    'home.widgets': [{ id: 'this-week-money', order: 20, component: ThisWeekWidget, labelKey: 'analytics:widget.title', icon: IndianRupee }],
  },
}

export default analytics
