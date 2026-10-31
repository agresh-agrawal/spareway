import { lazy } from 'react'
import type { FeatureModule } from '@/types/domain'
import en from './i18n/en.json'
import hi from './i18n/hi.json'

// lazy so the camera / voice code loads with the cargo list and the loader page, not with the app
const OwnerSmartAdd = lazy(() => import('./components/SmartAdd').then((m) => ({ default: m.OwnerSmartAdd })))
const LoaderSmartAdd = lazy(() => import('./components/SmartAdd').then((m) => ({ default: m.LoaderSmartAdd })))

const smartInput: FeatureModule = {
  id: 'smart-input',
  order: 28,
  i18n: { en, hi },
  slots: {
    'cargo.addMethods': [{ id: 'smart-input', order: 10, component: OwnerSmartAdd }],
    'loader.actions': [{ id: 'smart-input', order: 10, component: LoaderSmartAdd }],
  },
}

export default smartInput
