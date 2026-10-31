import type { ErrorCode } from '@/types/domain'

export class AppError extends Error {
  code: ErrorCode
  cause?: unknown
  constructor(code: ErrorCode, message?: string, cause?: unknown) {
    super(message ?? code)
    this.name = 'AppError'
    this.code = code
    this.cause = cause
  }
}

// Raised Postgres errors arrive as error.message containing the code (Engineering Reference 3).
const RAISED: ErrorCode[] = [
  'NOT_SIGNED_IN',
  'PLAN_NOT_FOUND',
  'TRIP_NOT_FOUND',
  'EXTRA_LOAD_NOT_FOUND',
  'ALREADY_ACCEPTED',
  'DROP_BEFORE_PICKUP',
  'LISTING_NOT_FOUND',
  'LISTING_NOT_OPEN',
  'LINK_INVALID',
  'PLAN_CHANGED',
  'BAD_DROP_STOP',
  'BAD_STATUS',
  'BAD_SOURCE',
  'BAD_ITEMS',
  'ORS_ERROR',
  'ORS_QUOTA',
  'AI_TIMEOUT',
  'AI_PARSE',
  'TOO_LARGE',
  'AUTH_REQUIRED',
]

interface ErrorLike {
  message?: string
  code?: string
  status?: number
  name?: string
}

/** Map anything thrown by supabase-js / fetch / our RPCs to an AppError. */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err
  const e = (err ?? {}) as ErrorLike
  const message = e.message ?? String(err)
  const code = e.code ?? ''
  const lower = message.toLowerCase()

  // Supabase Auth error codes (error.code) first, then message fallbacks
  if (code === 'invalid_credentials' || lower.includes('invalid login credentials'))
    return new AppError('INVALID_LOGIN', message, err)
  if (code === 'email_not_confirmed' || lower.includes('email not confirmed'))
    return new AppError('EMAIL_NOT_CONFIRMED', message, err)
  if (code === 'user_already_exists' || code === 'email_exists' || lower.includes('already registered'))
    return new AppError('EMAIL_TAKEN', message, err)
  if (code === 'weak_password' || lower.includes('password should'))
    return new AppError('WEAK_PASSWORD', message, err)
  if (
    code === 'over_request_rate_limit' ||
    code === 'over_email_send_rate_limit' ||
    e.status === 429 ||
    lower.includes('rate limit') ||
    lower.includes('for security purposes')
  )
    return new AppError('RATE_LIMITED', message, err)
  if (code === '23505') return new AppError('DUPLICATE', message, err)
  if (code === 'PGRST301' || code === 'session_not_found' || e.status === 401)
    return new AppError('NOT_SIGNED_IN', message, err)
  if (e.name === 'TypeError' && lower.includes('fetch')) return new AppError('NETWORK', message, err)
  if (lower.includes('failed to fetch') || lower.includes('network')) return new AppError('NETWORK', message, err)

  const raised = RAISED.find((c) => message.includes(c))
  if (raised) return new AppError(raised, message, err)
  return new AppError('UNKNOWN', message, err)
}

/** JSON errors from loader_* RPCs come back as data ({ error: CODE }) — check data.error first. */
export function throwIfDataError<T>(data: T): T {
  const d = data as { error?: string } | null
  if (d && typeof d === 'object' && typeof d.error === 'string') throw toAppError({ message: d.error })
  return data
}
