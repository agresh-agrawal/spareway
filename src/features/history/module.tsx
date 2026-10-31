import { lazy } from 'react'
import { History, Mail } from 'lucide-react'
import type { FeatureModule } from '@/types/domain'
import en from './i18n/en.json'
import hi from './i18n/hi.json'

const ReportSection = lazy(() => import('./components/ReportSection').then((m) => ({ default: m.ReportSection })))

/** Trip history (owner request 3): past trips, money per month, "Download my data" (CSV backup); monthly email. */
const history: FeatureModule = {
  id: 'history',
  order: 25,
  i18n: { en, hi },
  nav: { labelKey: 'common:nav.history', icon: History, path: '/history', phone: 'more' },
  routes: [{ path: '/history', element: lazy(() => import('./pages/HistoryPage')), titleKey: 'history:title' }],
  slots: {
    // monthly email report (owner request 6)
    'settings.sections': [{ id: 'monthly-report', order: 45, component: ReportSection, labelKey: 'history:report.title', icon: Mail }],
  },
}

export default history
