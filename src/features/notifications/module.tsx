import { lazy } from 'react'
import { Mail } from 'lucide-react'
import type { FeatureModule } from '@/types/domain'
import en from './i18n/en.json'
import hi from './i18n/hi.json'

const EmailSection = lazy(() => import('./components/EmailSection').then((m) => ({ default: m.EmailSection })))

/** Notification bar: the bell in the top bar + "Email me major changes" in Settings. */
const notifications: FeatureModule = {
  id: 'notifications',
  order: 37,
  i18n: { en, hi },
  slots: {
    'settings.sections': [{ id: 'notify-email', order: 41, component: EmailSection, labelKey: 'notifications:email.title', icon: Mail }],
  },
}

export default notifications
