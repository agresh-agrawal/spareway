import { lazy } from 'react'
import type { FeatureModule } from '@/types/domain'
import en from './i18n/en.json'
import hi from './i18n/hi.json'

const auth: FeatureModule = {
  id: 'auth',
  order: 100,
  i18n: { en, hi },
  publicRoutes: [
    { path: '/login', element: lazy(() => import('./pages/LoginPage')), guard: 'publicOnly' },
    { path: '/signup', element: lazy(() => import('./pages/SignupPage')), guard: 'publicOnly' },
    { path: '/forgot-password', element: lazy(() => import('./pages/ForgotPasswordPage')), guard: 'publicOnly' },
    { path: '/reset-password', element: lazy(() => import('./pages/ResetPasswordPage')), guard: 'none' },
    { path: '/auth/callback', element: lazy(() => import('./pages/AuthCallbackPage')), guard: 'none' },
  ],
}

export default auth
