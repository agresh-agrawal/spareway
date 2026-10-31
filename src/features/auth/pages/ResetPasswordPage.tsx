import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { KeyRound, Save } from 'lucide-react'
import { toast } from 'sonner'
import { MainButton, TextField } from '@/components/common'
import { useAuth } from '@/app/auth/AuthProvider'
import { useLang } from '@/lib/i18n'
import { toAppError } from '@/lib/errors'
import type { ErrorCode } from '@/types/domain'
import { resetSchema, type ResetValues } from '../schemas'
import { AuthCard, FormError } from '../components/AuthCard'

/** From the email link: supabase-js picks up the recovery session from the URL. */
export default function ResetPasswordPage() {
  const { t } = useLang('auth')
  const auth = useAuth()
  const nav = useNavigate()
  const [code, setCode] = useState<ErrorCode | null>(null)
  const [expired, setExpired] = useState(false)
  const form = useForm<ResetValues>({ resolver: zodResolver(resetSchema), defaultValues: { password: '', confirm: '' } })
  const err = (k?: string) => (k ? t(k) : undefined)

  useEffect(() => {
    const p = new URLSearchParams(window.location.hash.slice(1) || window.location.search)
    if (p.get('error_code') === 'otp_expired' || p.get('error')) setExpired(true)
  }, [])

  useEffect(() => {
    // no session arrives within a few seconds → the link is not usable
    if (auth.session) return
    const id = setTimeout(() => setExpired((e) => e || auth.status === 'signedOut'), 4000)
    return () => clearTimeout(id)
  }, [auth.session, auth.status])

  const onSubmit = form.handleSubmit(async (v) => {
    setCode(null)
    try {
      await auth.updatePassword(v.password)
      toast.success(t('passwordSaved'))
      nav('/', { replace: true })
    } catch (e) {
      const c = toAppError(e).code
      if (c === 'NOT_SIGNED_IN') setExpired(true)
      else setCode(c)
    }
  })

  if (expired)
    return (
      <AuthCard title={t('resetTitle')}>
        <FormError>{t('resetExpired')}</FormError>
        <Link to="/forgot-password" className="mt-4 flex min-h-12 items-center justify-center gap-2 font-semibold text-accent">
          <KeyRound size={20} aria-hidden />
          {t('getNewLink')}
        </Link>
      </AuthCard>
    )

  return (
    <AuthCard title={t('resetTitle')}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <TextField
          label={t('newPassword')}
          reveal
          autoComplete="new-password"
          help={t('passwordHelp')}
          error={err(form.formState.errors.password?.message)}
          {...form.register('password')}
        />
        <TextField label={t('confirmPassword')} reveal autoComplete="new-password" error={err(form.formState.errors.confirm?.message)} {...form.register('confirm')} />
        {code && <FormError>{t(`common:errors.${code}`)}</FormError>}
        <MainButton type="submit" icon={Save} loading={form.formState.isSubmitting} className="w-full">
          {t('savePassword')}
        </MainButton>
      </form>
    </AuthCard>
  )
}
