import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Building2, ChevronDown, ChevronUp, FlaskConical, IndianRupee, KeyRound, RotateCcw, Save, Undo2, UserRound } from 'lucide-react'
import {
  Card,
  CardHeader,
  ConfirmDialog,
  MainButton,
  NumberField,
  PlainButton,
  Sheet,
  TextField,
} from '@/components/common'
import { Slot } from '@/app/slots'
import { useAuth } from '@/app/auth/AuthProvider'
import { useLang } from '@/lib/i18n'
import { toAppError } from '@/lib/errors'
import { cn } from '@/lib/cn'
import { resetSchema, type ResetValues } from '@/features/auth'
import type { CompanySettings, Lang } from '@/types/domain'
import { resetSampleData, saveSettings } from '../api'
import {
  COST_FIELDS,
  FIELD_RANGE,
  MORE_FIELDS,
  settingsSchema,
  type CostField,
  type SettingsInput,
  type SettingsValues,
} from '../schemas'

function toForm(fullName: string, company: { name: string; city: string; phone: string }, s: CompanySettings): SettingsInput {
  const v: Record<string, unknown> = { fullName, companyName: company.name, city: company.city, phone: company.phone }
  for (const f of [...COST_FIELDS, ...MORE_FIELDS]) v[f] = Number(s[f])
  return v as SettingsInput
}

function LanguagePicker() {
  const { t, lang, set } = useLang('settings')
  const opt = (l: Lang, label: string) => (
    <button
      type="button"
      onClick={() => set(l)}
      aria-pressed={lang === l}
      className={cn(
        'h-12 flex-1 rounded-[12px] font-semibold transition-colors duration-200',
        lang === l ? 'bg-accent text-accent-ink' : 'text-ink-2 hover:text-ink',
      )}
    >
      {label}
    </button>
  )
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-label font-medium text-ink-2">{t('language')}</span>
      <div className="flex gap-1 rounded-control border border-line-strong bg-surface-2 p-1">
        {opt('en', t('english'))}
        {opt('hi', t('hindi'))}
      </div>
      <span className="text-label text-ink-3">{t('languageHelp')}</span>
    </div>
  )
}

function PasswordSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useLang('settings')
  const { updatePassword } = useAuth()
  const form = useForm<ResetValues>({ resolver: zodResolver(resetSchema), defaultValues: { password: '', confirm: '' } })
  const err = (k?: string) => (k ? t(k) : undefined)
  const submit = form.handleSubmit(async (v) => {
    try {
      await updatePassword(v.password)
      toast.success(t('passwordSaved'))
      form.reset()
      onOpenChange(false)
    } catch (e) {
      form.setError('password', { message: `common:errors.${toAppError(e).code}` })
    }
  })
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('changePassword')}
      dirty={form.formState.isDirty}
      footer={
        <MainButton icon={Save} onClick={submit} loading={form.formState.isSubmitting} className="w-full">
          {t('savePassword')}
        </MainButton>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <TextField label={t('newPassword')} reveal autoComplete="new-password" help={t('auth:passwordHelp')} error={err(form.formState.errors.password?.message)} {...form.register('password')} />
        <TextField label={t('confirmPassword')} reveal autoComplete="new-password" error={err(form.formState.errors.confirm?.message)} {...form.register('confirm')} />
      </form>
    </Sheet>
  )
}

export default function SettingsPage() {
  const { t } = useLang('settings')
  const qc = useQueryClient()
  const { user, profile, company, settings, refreshProfile } = useAuth()
  const [more, setMore] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetting, setResetting] = useState(false)

  const defaults = useMemo(
    () => (profile && company && settings ? toForm(profile.full_name, company, settings) : undefined),
    [profile, company, settings],
  )
  const form = useForm<SettingsInput, unknown, SettingsValues>({ resolver: zodResolver(settingsSchema), values: defaults })
  const errors = form.formState.errors
  const err = (k?: string) => (k ? t(k) : undefined)
  const isGoogle = user?.app_metadata?.provider === 'google'

  const save = form.handleSubmit(async (v) => {
    if (!user || !company) return
    try {
      await saveSettings({ userId: user.id, companyId: company.id }, v)
      await refreshProfile()
      qc.invalidateQueries({ queryKey: ['me'] })
      toast.success(t('saved'))
    } catch (e) {
      toast.error(t(`common:errors.${toAppError(e).code}`)) // typed values stay in the form
    }
  })

  const reset = async () => {
    setResetting(true)
    try {
      await resetSampleData()
      qc.invalidateQueries()
      toast.success(t('resetDone'))
      setConfirmReset(false)
    } catch (e) {
      toast.error(t(`common:errors.${toAppError(e).code}`))
    } finally {
      setResetting(false)
    }
  }

  const numberField = (f: CostField, withHelp: boolean) => {
    const [min, max] = FIELD_RANGE[f]
    const help = withHelp ? `${t(`help.${f}`)} · ${t('help.range', { min, max })}` : t('help.range', { min, max })
    return (
      <NumberField
        key={f}
        label={t(`fields.${f}`)}
        help={help}
        min={min}
        max={max}
        error={err(errors[f]?.message)}
        {...form.register(f)}
      />
    )
  }

  if (!defaults) return null

  return (
    <form onSubmit={save} className="mx-auto flex max-w-3xl flex-col gap-4 pb-24" noValidate>
      <Card>
        <CardHeader icon={UserRound} title={t('account')} />
        <div className="flex flex-col gap-4">
          <TextField label={t('name')} autoComplete="name" error={err(errors.fullName?.message)} {...form.register('fullName')} />
          <TextField label={t('email')} value={profile?.email ?? ''} readOnly disabled />
          <LanguagePicker />
          {isGoogle ? (
            <p className="text-label text-ink-3">{t('googleAccount')}</p>
          ) : (
            <PlainButton type="button" icon={KeyRound} onClick={() => setPwOpen(true)} className="self-start">
              {t('changePassword')}
            </PlainButton>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader icon={Building2} title={t('company')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <TextField label={t('companyName')} autoComplete="organization" error={err(errors.companyName?.message)} {...form.register('companyName')} />
          </div>
          <TextField label={t('city')} autoComplete="address-level2" error={err(errors.city?.message)} {...form.register('city')} />
          <TextField label={t('phone')} type="tel" autoComplete="tel" inputMode="tel" error={err(errors.phone?.message)} {...form.register('phone')} />
        </div>
      </Card>

      <Card>
        <CardHeader icon={IndianRupee} title={t('costs')} />
        <p className="-mt-2 mb-4 text-ink-2">{t('costsHelp')}</p>
        <div className="grid gap-4 sm:grid-cols-2">{COST_FIELDS.map((f) => numberField(f, true))}</div>
        <button
          type="button"
          onClick={() => setMore((m) => !m)}
          aria-expanded={more}
          className="mt-4 flex min-h-12 w-full items-center justify-between rounded-tile border border-line bg-surface-2 px-4 font-semibold hover:bg-surface-3"
        >
          {t('moreSettings')}
          {more ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
        {more && <div className="mt-4 grid gap-4 sm:grid-cols-2">{MORE_FIELDS.map((f) => numberField(f, false))}</div>}
      </Card>

      <Card>
        <CardHeader icon={FlaskConical} title={t('demo')} />
        <p className="mb-4 text-ink-2">{t('demoText')}</p>
        <PlainButton type="button" icon={RotateCcw} onClick={() => setConfirmReset(true)}>
          {t('reset')}
        </PlainButton>
      </Card>

      <Slot name="settings.sections" props={{}} />

      {form.formState.isDirty && (
        <div className="safe-bottom fixed inset-x-0 bottom-16 z-30 border-t border-line-strong bg-surface/95 backdrop-blur lg:bottom-0 lg:pl-[104px]">
          <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
            <span className="hidden flex-1 text-ink-2 sm:block">{t('saveBar')}</span>
            <PlainButton type="button" icon={Undo2} onClick={() => form.reset(defaults)} className="flex-1 sm:flex-none">
              {t('discard')}
            </PlainButton>
            <MainButton type="submit" icon={Save} loading={form.formState.isSubmitting} className="flex-1 sm:flex-none">
              {t('common:actions.save')}
            </MainButton>
          </div>
        </div>
      )}

      <PasswordSheet open={pwOpen} onOpenChange={setPwOpen} />
      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title={t('resetConfirmTitle')}
        text={t('resetConfirmText')}
        confirmLabel={t('reset')}
        confirmIcon={RotateCcw}
        onConfirm={reset}
        loading={resetting}
      />
    </form>
  )
}
