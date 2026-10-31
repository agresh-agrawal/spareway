import { lazy } from 'react'
import { Send } from 'lucide-react'
import type { FeatureModule, LoaderStepStatus } from '@/types/domain'
import { registerSender } from '@/features/offline'
import { updateStep } from './api'
import en from './i18n/en.json'
import hi from './i18n/hi.json'
import { loaderStepDone } from './lib/stepState'

const LoaderStep = lazy(() => import('./components/LoaderStep').then((m) => ({ default: m.LoaderStep })))

const loader: FeatureModule = {
  id: 'loader',
  order: 32,
  i18n: { en, hi },
  publicRoutes: [{ path: '/load/:token', element: lazy(() => import('./pages/LoaderPage')), guard: 'none' }],
  slots: {
    'trip.steps': [
      { id: 'loader', order: 3, component: LoaderStep, labelKey: 'loader:step', icon: Send, done: ({ tripId }) => loaderStepDone(tripId) },
    ],
  },
}

// loader Done / Problem taps made without internet (Phase 4·Code F21)
registerSender<{ token: string; planId: string; step: number; status: LoaderStepStatus; note?: string }>('loader_step', (v) =>
  updateStep(v.token, v.planId, v.step, v.status, v.note),
)

export default loader
