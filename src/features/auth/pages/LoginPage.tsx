import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { LogIn, Send } from 'lucide-react'
import { toast } from 'sonner'
import { GoogleButton, MainButton, PlainButton, TextField } from '@/components/common'
import { useAuth } from '@/app/auth/AuthProvider'
import { safeNext } from '@/app/auth/guards'
import { useLang } from '@/lib/i18n'
import { toAppError } from '@/lib/errors'
import type { ErrorCode } from '@/types/domain'
import { loginSchema, type LoginValues } from '../schemas'
import { AuthCard, FormError, OrDivider } from '../components/AuthCard'

export default function LoginPage() {
  const { t } = useLang('auth')
  const auth = useAuth()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const [code, setCode] = useState<ErrorCode | null>(
    params.get('error') === 'google_cancelled' ? null : (params.get('error') as ErrorCode | null),
  )
  const [googleBusy, setGoogleBusy] = useState(false)
  const [resending, setResending] = useState(false)
  const cancelled = params.get('error') === 'google_cancelled'

  const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } })
  const err = (k?: string) => (k ? t(k) : undefined)

  const onSubmit = form.handleSubmit(async (v) => {
    setCode(null)
    try {
      await auth.signInWithPassword(v.email.trim(), v.password)
    } catch (e) {
      setCode(toAppError(e).code)
    }
  })

  const google = async () => {
    setGoogleBusy(true)
    setCode(null)
    try {
      await auth.signInWithGoogle(next)
    } catch (e) {
      setCode(toAppError(e).code)
      setGoogleBusy(false)
    }
  }

  const resend = async () => {
    setResending(true)
    try {
      await auth.resendConfirmation(form.getValues('email').trim())
      toast.success(t('resent'))
    } catch (e) {
      setCode(toAppError(e).code)
    } finally {
      setResending(false)
    }
  }

  return (
    <AuthCard title={t('loginTitle')}>
      <GoogleButton onClick={google} loading={googleBusy}>
        {t('google')}
      </GoogleButton>
      <OrDivider label={t('or')} />
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <TextField
          label={t('email')}
          type="email"
          autoComplete="email"
          inputMode="email"
          error={err(form.formState.errors.email?.message)}
          {...form.register('email')}
        />
        <TextField
          label={t('password')}
          reveal
          autoComplete="current-password"
          error={err(form.formState.errors.password?.message)}
          {...form.register('password')}
        />
        {cancelled && !code && <FormError>{t('googleCancelled')}</FormError>}
        {code && <FormError>{t(`common:errors.${code}`)}</FormError>}
        {code === 'EMAIL_NOT_CONFIRMED' && (
          <PlainButton type="button" icon={Send} onClick={resend} loading={resending}>
            {t('notConfirmedResend')}
          </PlainButton>
        )}
        <MainButton type="submit" icon={LogIn} loading={form.formState.isSubmitting} className="w-full">
          {t('login')}
        </MainButton>
      </form>
      <div className="mt-5 flex flex-col gap-1 text-center">
        <Link to="/forgot-password" className="flex min-h-12 items-center justify-center font-medium text-ink-2 hover:text-ink">
          {t('forgotLink')}
        </Link>
        <Link
          to={`/signup${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`}
          className="flex min-h-12 items-center justify-center font-semibold text-accent"
        >
          {t('noAccount')}
        </Link>
      </div>
    </AuthCard>
  )
}
