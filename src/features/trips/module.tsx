import { lazy } from 'react'
import { Plus, Route } from 'lucide-react'
import { QuickAction } from '@/components/common'
import { useLang } from '@/lib/i18n'
import type { FeatureModule } from '@/types/domain'
import en from './i18n/en.json'
import hi from './i18n/hi.json'

function NewTripAction() {
  const { t } = useLang('trips')
  return <QuickAction to="/trips/new" icon={Plus} label={t('newTrip')} />
}

const trips: FeatureModule = {
  id: 'trips',
  order: 20,
  i18n: { en, hi },
  nav: { labelKey: 'common:nav.trips', icon: Route, path: '/trips', phone: 'tab' },
  routes: [
    { path: '/trips', element: lazy(() => import('./pages/TripsPage')), titleKey: 'trips:title' },
    { path: '/trips/new', element: lazy(() => import('./pages/NewTripPage')), titleKey: 'trips:wizard.title' },
    { path: '/trips/:tripId', element: lazy(() => import('./pages/TripPage')), titleKey: 'trips:title' },
  ],
  slots: {
    'home.actions': [{ id: 'trips.new', order: 10, component: NewTripAction, labelKey: 'trips:newTrip', icon: Plus }],
  },
}

export default trips
