import { lazy } from 'react'
import { Settings } from 'lucide-react'
import type { FeatureModule } from '@/types/domain'
import en from './i18n/en.json'
import hi from './i18n/hi.json'

const settings: FeatureModule = {
  id: 'settings',
  order: 99,
  i18n: { en, hi },
  nav: { labelKey: 'common:nav.settings', icon: Settings, path: '/settings', phone: 'more' },
  routes: [{ path: '/settings', element: lazy(() => import('./pages/SettingsPage')), titleKey: 'settings:title' }],
}

export default settings
