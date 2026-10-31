import { lazy } from 'react'
import { Bell, ShieldAlert } from 'lucide-react'
import type { FeatureModule } from '@/types/domain'
import en from './i18n/en.json'
import hi from './i18n/hi.json'

const ChallanStep = lazy(() => import('./components/ChallanStep').then((m) => ({ default: m.ChallanStep })))
const NotifySection = lazy(() => import('./components/NotifySection').then((m) => ({ default: m.NotifySection })))

/** Challan corner (owner request 4): risks + fines per trip, trip costs in the net earnings, live owner alerts. */
const challan: FeatureModule = {
  id: 'challan',
  order: 36,
  i18n: { en, hi },
  slots: {
    'trip.steps': [{ id: 'challan', order: 7, component: ChallanStep, labelKey: 'challan:step', icon: ShieldAlert }],
    'settings.sections': [{ id: 'notify', order: 40, component: NotifySection, labelKey: 'challan:notify.title', icon: Bell }],
  },
}

export default challan
