// /post/:token — the transporter's shared link for load providers, no login. Asks once: trader or shipper, name,
// mobile → opens that person's own page (/my-loads/:portal), remembered on this phone.
import { useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowRight, Factory, LinkIcon, Store } from 'lucide-react'
import { Card, MainButton, Skeleton, TextField } from '@/components/common'
import { useLang } from '@/lib/i18n'
import { toAppError } from '@/lib/errors'
import { cn } from '@/lib/cn'
import { getLinkInfo, joinProvider, type ProviderKind } from '../api'
import { PublicFrame } from '../components/PublicFrame'
import { formErrors, shipperSchema } from '../lib/offer'

const portalKey = (token: string) => `spareway.portal.${token}`

function savedPortal(token: string): string | null {
  try {
    return localStorage.getItem(portalKey(token))
  } catch {
    return null
  }
}

export default function ProviderPostPage() {
  const { token = '' } = useParams()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const { t } = useLang('provider')
  const info = useQuery({ queryKey: ['providerLink', token], queryFn: () => getLinkInfo(token), retry: false })
  const [kind, setKind] = useState<ProviderKind | null>(null)
  const [who, setWho] = useState({ name: '', phone: '' })
  const [errs, setErrs] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const saved = params.get('new') ? null : savedPortal(token)

  if (saved) return <Navigate to={`/my-loads/${saved}`} replace />
  if (info.isLoading)
    return (
      <PublicFrame>
        <Skeleton className="h-40" />
        <Skeleton className="h-72" />
      </PublicFrame>
    )
  if (info.error || !info.data)
    return (
      <PublicFrame>
        <div className="mt-10 flex flex-col items-center gap-4 text-center">
          <span className="flex size-20 items-center justify-center rounded-full bg-crit/15 text-crit">
            <LinkIcon size={40} aria-hidden />
          </span>
          <h1 className="text-[26px] leading-8 font-semibold">{t('ended')}</h1>
          <p className="text-[18px] text-ink-2">{t('endedText')}</p>
        </div>
      </PublicFrame>
    )
  const company = info.data.company

  const open = async () => {
    const r = shipperSchema.safeParse(who)
    const e = formErrors(r)
    if (!kind) e.kind = 'provider:join.pickKind'
    setErrs(e)
    if (!r.success || !kind) return
    setBusy(true)
    try {
      const portal = await joinProvider(token, kind, r.data.name, r.data.phone)
      try {
        localStorage.setItem(portalKey(token), portal)
      } catch {
        /* private window: the page link still works */
      }
      nav(`/my-loads/${portal}`, { replace: true })
    } catch (err) {
      toast.error(t(`common:errors.${toAppError(err).code}`))
    } finally {
      setBusy(false)
    }
  }

  const KINDS: { id: ProviderKind; icon: typeof Store }[] = [
    { id: 'trader', icon: Store },
    { id: 'shipper', icon: Factory },
  ]

  return (
    <PublicFrame title={t('join.title')} sub={t('to', { company: company.name })}>
      <p className="text-[18px] leading-7 text-ink-2">{t('join.intro', { company: company.name })}</p>
      <Card className="flex flex-col gap-3">
        <h2 className="text-section-title font-semibold">{t('join.whoAreYou')}</h2>
        <div role="radiogroup" aria-label={t('join.whoAreYou')} className="grid gap-3 sm:grid-cols-2">
          {KINDS.map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={kind === id}
              onClick={() => setKind(id)}
              className={cn(
                'flex items-start gap-3 rounded-tile border p-4 text-left transition-colors',
                kind === id ? 'border-accent bg-accent-soft' : 'border-line-strong bg-surface-2 hover:bg-surface-3',
              )}
            >
              <Icon size={28} className={kind === id ? 'text-accent' : 'text-ink-2'} aria-hidden />
              <span>
                <span className="block text-[19px] font-semibold">{t(`join.${id}`)}</span>
                <span className="block text-ink-2">{t(`join.${id}Help`)}</span>
              </span>
            </button>
          ))}
        </div>
        {errs.kind && <p className="text-crit">{t(errs.kind)}</p>}
      </Card>
      <Card className="flex flex-col gap-4">
        <TextField label={t('name')} value={who.name} error={errs.name ? t(errs.name) : undefined} onChange={(e) => setWho({ ...who, name: e.target.value })} />
        <TextField
          label={t('phone')}
          type="tel"
          inputMode="tel"
          placeholder="98270 12345"
          help={t('join.phoneHelp')}
          value={who.phone}
          error={errs.phone ? t(errs.phone) : undefined}
          onChange={(e) => setWho({ ...who, phone: e.target.value })}
        />
        <MainButton icon={ArrowRight} size="lg" loading={busy} onClick={open} className="w-full">
          {t('join.open')}
        </MainButton>
      </Card>
    </PublicFrame>
  )
}
