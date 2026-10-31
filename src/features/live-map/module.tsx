import { lazy } from 'react'
import { Map as MapIcon, MapPin } from 'lucide-react'
import { QuickAction } from '@/components/common'
import { useLang } from '@/lib/i18n'
import type { FeatureModule } from '@/types/domain'
import en from './i18n/en.json'
import hi from './i18n/hi.json'

const HomeMap = lazy(() => import('./components/HomeMap').then((m) => ({ default: m.HomeMap })))
const TruckLocation = lazy(() => import('./components/TruckLocation').then((m) => ({ default: m.TruckLocation })))

function LiveMapAction() {
  const { t } = useLang('live-map')
  return <QuickAction to="/map" icon={MapIcon} label={t('action')} />
}

const liveMap: FeatureModule = {
  id: 'live-map',
  order: 30,
  i18n: { en, hi },
  nav: { labelKey: 'common:nav.map', icon: MapIcon, path: '/map', phone: 'tab' },
  routes: [{ path: '/map', element: lazy(() => import('./pages/LiveMapPage')), titleKey: 'live-map:title' }],
  slots: {
    'home.actions': [{ id: 'live-map', order: 30, component: LiveMapAction, labelKey: 'live-map:action', icon: MapIcon }],
    'home.widgets': [{ id: 'live-map', order: 5, component: HomeMap }],
    'truck.tabs': [{ id: 'location', order: 20, component: TruckLocation, labelKey: 'live-map:tab', icon: MapPin }],
  },
}

export default liveMap
