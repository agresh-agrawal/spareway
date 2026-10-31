import { lazy } from 'react'
import { Truck } from 'lucide-react'
import type { FeatureModule } from '@/types/domain'
import en from './i18n/en.json'
import hi from './i18n/hi.json'

const trucks: FeatureModule = {
  id: 'trucks',
  order: 10,
  i18n: { en, hi },
  nav: { labelKey: 'common:nav.trucks', icon: Truck, path: '/trucks', phone: 'tab' },
  routes: [
    { path: '/trucks', element: lazy(() => import('./pages/TrucksPage')), titleKey: 'trucks:title' },
    { path: '/trucks/:truckId', element: lazy(() => import('./pages/TruckPage')), titleKey: 'trucks:title' },
  ],
}

export default trucks
