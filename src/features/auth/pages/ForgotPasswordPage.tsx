import { useState } from 'react'
import { Link } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, CheckCircle2, Send } from 'lucide-react'
import { MainButton, TextField } from '@/components/common'
import { useAuth } from '@/app/auth/AuthProvider'
import { useLang } from '@/lib/i18n'
import { toAppError } from '@/lib/errors'
import type { ErrorCode } from '@/types/domain'
import { forgotSchema, type ForgotValues } from '../schemas'
import { AuthCard, FormError } from '../components/AuthCard'

export default function ForgotPasswordPage() {
  const { t } = useLang('auth')
  const auth = useAuth()
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState<ErrorCode | null>(null)
  const form = useForm<ForgotValues>({ resolver: zodResolver(forgotSchema), defaultValues: { email: '' } })

  const onSubmit = form.handleSubmit(async (v) => {
    setCode(null)
    try {
      await auth.sendPasswordReset(v.email.trim())
      setSent(true) // always the same message, whether or not the email exists
    } catch (e) {
      setCode(toAppError(e).code)
    }
  })

  return (
    <AuthCard title={t('forgotTitle')}>
      {sent ? (
        <p className="flex items-start gap-3 rounded-tile border border-ok/40 bg-ok/[0.08] p-3">
          <CheckCircle2 size={22} className="mt-0.5 shrink-0 text-ok" aria-hidden />
          {t('forgotSent')}
        </p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <p className="text-ink-2">{t('forgotText')}</p>
          <TextField
            label={t('email')}
            type="email"
            autoComplete="email"
            inputMode="email"
            error={form.formState.errors.email?.message ? t(form.formState.errors.email.message) : undefined}
            {...form.register('email')}
          />
          {code && <FormError>{t(`common:errors.${code}`)}</FormError>}
          <MainButton type="submit" icon={Send} loading={form.formState.isSubmitting} className="w-full">
            {t('sendLink')}
          </MainButton>
        </form>
      )}
      <Link to="/login" className="mt-4 flex min-h-12 items-center justify-center gap-2 font-semibold text-accent">
        <ArrowLeft size={20} aria-hidden />
        {t('backToLogin')}
      </Link>
    </AuthCard>
  )
}
