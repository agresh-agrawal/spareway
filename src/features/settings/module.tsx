import { lazy } from 'react'
import { Settings, ShieldCheck } from 'lucide-react'
import type { FeatureModule } from '@/types/domain'
import en from './i18n/en.json'
import hi from './i18n/hi.json'

const PrivacySection = lazy(() => import('./components/PrivacySection').then((m) => ({ default: m.PrivacySection })))

const settings: FeatureModule = {
  id: 'settings',
  order: 99,
  i18n: { en, hi },
  nav: { labelKey: 'common:nav.settings', icon: Settings, path: '/settings', phone: 'more' },
  routes: [{ path: '/settings', element: lazy(() => import('./pages/SettingsPage')), titleKey: 'settings:title' }],
  slots: {
    'settings.sections': [{ id: 'privacy', order: 90, component: PrivacySection, labelKey: 'settings:privacy.title', icon: ShieldCheck }],
  },
}

export default settings
