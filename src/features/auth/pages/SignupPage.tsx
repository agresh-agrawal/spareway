import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Mail, Send, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { GoogleButton, MainButton, PlainButton, TextField } from '@/components/common'
import { useAuth } from '@/app/auth/AuthProvider'
import { safeNext } from '@/app/auth/guards'
import { useLang } from '@/lib/i18n'
import { toAppError } from '@/lib/errors'
import type { ErrorCode } from '@/types/domain'
import { signupSchema, type SignupValues } from '../schemas'
import { AuthCard, FormError, OrDivider } from '../components/AuthCard'
import { useCooldown } from '../hooks/useCooldown'

export default function SignupPage() {
  const { t } = useLang('auth')
  const auth = useAuth()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const [code, setCode] = useState<ErrorCode | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [googleBusy, setGoogleBusy] = useState(false)
  const cooldown = useCooldown()

  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: '', companyName: '', email: '', password: '', confirm: '' },
  })
  const err = (k?: string) => (k ? t(k) : undefined)

  const onSubmit = form.handleSubmit(async (v) => {
    setCode(null)
    try {
      const { needsConfirmation } = await auth.signUp({
        fullName: v.fullName.trim(),
        companyName: v.companyName.trim(),
        email: v.email.trim(),
        password: v.password,
      })
      // session back → AuthProvider takes over ("Setting up your demo trucks…")
      if (needsConfirmation) {
        setSentTo(v.email.trim())
        cooldown.start(60)
      }
    } catch (e) {
      setCode(toAppError(e).code)
    }
  })

  const google = async () => {
    setGoogleBusy(true)
    try {
      await auth.signInWithGoogle(next)
    } catch (e) {
      setCode(toAppError(e).code)
      setGoogleBusy(false)
    }
  }

  const resend = async () => {
    if (!sentTo) return
    try {
      await auth.resendConfirmation(sentTo)
      toast.success(t('resent'))
      cooldown.start(60)
    } catch (e) {
      toast.error(t(`common:errors.${toAppError(e).code}`))
    }
  }

  if (sentTo)
    return (
      <AuthCard title={t('checkEmailTitle')}>
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Mail size={30} aria-hidden />
          </span>
          <p className="text-ink-2">{t('checkEmailText', { email: sentTo })}</p>
          <PlainButton icon={Send} onClick={resend} disabled={cooldown.left > 0} className="w-full">
            {cooldown.left > 0 ? t('resendIn', { s: cooldown.left }) : t('resend')}
          </PlainButton>
          <Link to="/login" className="flex min-h-12 items-center gap-2 font-semibold text-accent">
            <ArrowLeft size={20} aria-hidden />
            {t('backToLogin')}
          </Link>
        </div>
      </AuthCard>
    )

  return (
    <AuthCard title={t('signupTitle')}>
      <GoogleButton onClick={google} loading={googleBusy}>
        {t('google')}
      </GoogleButton>
      <OrDivider label={t('or')} />
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <TextField label={t('fullName')} autoComplete="name" error={err(form.formState.errors.fullName?.message)} {...form.register('fullName')} />
        <TextField
          label={t('companyName')}
          autoComplete="organization"
          help={t('companyHelp')}
          error={err(form.formState.errors.companyName?.message)}
          {...form.register('companyName')}
        />
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
          autoComplete="new-password"
          help={t('passwordHelp')}
          error={err(form.formState.errors.password?.message)}
          {...form.register('password')}
        />
        <TextField
          label={t('confirmPassword')}
          reveal
          autoComplete="new-password"
          error={err(form.formState.errors.confirm?.message)}
          {...form.register('confirm')}
        />
        {code && <FormError>{t(`common:errors.${code}`)}</FormError>}
        <MainButton type="submit" icon={UserPlus} loading={form.formState.isSubmitting} className="w-full">
          {t('createAccount')}
        </MainButton>
      </form>
      <Link to="/login" className="mt-4 flex min-h-12 items-center justify-center font-semibold text-accent">
        {t('haveAccount')}
      </Link>
    </AuthCard>
  )
}
