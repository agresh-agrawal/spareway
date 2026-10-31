import { lazy } from 'react'
import type { FeatureModule } from '@/types/domain'
import en from './i18n/en.json'
import hi from './i18n/hi.json'

const SaveMapSection = lazy(() => import('./components/SaveMapSection').then((m) => ({ default: m.SaveMapSection })))

const offline: FeatureModule = {
  id: 'offline',
  order: 95,
  i18n: { en, hi },
  slots: {
    'settings.sections': [{ id: 'offline-map', order: 50, component: SaveMapSection }],
  },
}

export default offline
