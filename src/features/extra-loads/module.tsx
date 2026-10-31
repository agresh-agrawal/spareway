import { lazy } from 'react'
import { PackageSearch, Truck } from 'lucide-react'
import type { FeatureModule } from '@/types/domain'
import en from './i18n/en.json'
import hi from './i18n/hi.json'
import { tripHasExtra } from './lib/stepState'

const ExtraLoadsStep = lazy(() => import('./components/ExtraLoadsStep').then((m) => ({ default: m.ExtraLoadsStep })))
const FindExtraAction = lazy(() => import('./components/HomeSlots').then((m) => ({ default: m.FindExtraAction })))
const ExtraEarningsWidget = lazy(() => import('./components/HomeSlots').then((m) => ({ default: m.ExtraEarningsWidget })))

const extraLoads: FeatureModule = {
  id: 'extra-loads',
  order: 40,
  i18n: { en, hi },
  nav: { labelKey: 'common:nav.loads', icon: Truck, path: '/loads', phone: 'more' },
  routes: [
    { path: '/loads', element: lazy(() => import('./pages/LoadsPage')), titleKey: 'extra-loads:loads.title' },
    { path: '/loads/new', element: lazy(() => import('./pages/PostLoadPage')), titleKey: 'extra-loads:form.title' },
  ],
  slots: {
    'trip.steps': [
      { id: 'extra-loads', order: 5, component: ExtraLoadsStep, labelKey: 'extra-loads:step', icon: PackageSearch, done: ({ tripId }) => tripHasExtra(tripId) },
    ],
    'home.actions': [{ id: 'find-extra-loads', order: 40, component: FindExtraAction, labelKey: 'extra-loads:findExtra', icon: PackageSearch }],
    'home.widgets': [{ id: 'extra-earnings', order: 10, component: ExtraEarningsWidget, labelKey: 'extra-loads:widget.title', icon: PackageSearch }],
  },
}

export default extraLoads
