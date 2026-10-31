// Public API of the auth feature. The hook itself lives in the shared core (src/app/auth).
export { useAuth } from '@/app/auth/AuthProvider'
export { resetSchema, password as passwordSchema, type ResetValues } from './schemas'
