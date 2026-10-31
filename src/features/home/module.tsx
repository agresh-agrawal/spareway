import { lazy } from 'react'
import { Home } from 'lucide-react'
import type { FeatureModule } from '@/types/domain'
import en from './i18n/en.json'
import hi from './i18n/hi.json'

const home: FeatureModule = {
  id: 'home',
  order: 0,
  i18n: { en, hi },
  nav: { labelKey: 'common:nav.home', icon: Home, path: '/', phone: 'tab' },
  routes: [{ path: '/', element: lazy(() => import('./pages/HomePage')), titleKey: 'home:title' }],
}

export default home
