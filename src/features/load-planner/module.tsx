import { lazy } from 'react'
import { Boxes } from 'lucide-react'
import type { FeatureModule } from '@/types/domain'
import en from './i18n/en.json'
import hi from './i18n/hi.json'
import { tripHasActivePlan } from './lib/stepState'

// slot components are lazy so three.js and the engine stay out of the first load
const LoadPlanStep = lazy(() => import('./components/slots').then((m) => ({ default: m.LoadPlanStep })))
const PlanLoadAction = lazy(() => import('./components/slots').then((m) => ({ default: m.PlanLoadAction })))
const TruckLoadLayout = lazy(() => import('./components/slots').then((m) => ({ default: m.TruckLoadLayout })))

const loadPlanner: FeatureModule = {
  id: 'load-planner',
  order: 25,
  i18n: { en, hi },
  routes: [{ path: '/trips/:tripId/plan', element: lazy(() => import('./pages/LoadPlanPage')), titleKey: 'load-planner:title' }],
  slots: {
    'trip.steps': [
      {
        id: 'load-plan',
        order: 2,
        component: LoadPlanStep,
        labelKey: 'common:words.loadPlan',
        icon: Boxes,
        done: ({ tripId }) => tripHasActivePlan(tripId),
      },
    ],
    'home.actions': [{ id: 'plan-load', order: 20, component: PlanLoadAction, labelKey: 'load-planner:planLoad', icon: Boxes }],
    'truck.tabs': [{ id: 'load-layout', order: 10, component: TruckLoadLayout, labelKey: 'load-planner:truckTab.label', icon: Boxes }],
  },
}

export default loadPlanner
