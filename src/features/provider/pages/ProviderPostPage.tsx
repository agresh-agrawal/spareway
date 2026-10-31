// /post/:token — load provider, no login (stage 5): who you are, then one or more loads (batch), "Send loads".
// After sending, each load has its own link to see offers, change or take it off.
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CheckCircle2, ExternalLink, LinkIcon, Plus, Send, Trash2 } from 'lucide-react'
import { Card, MainButton, PlainButton, Skeleton, TextField } from '@/components/common'
import { useLang } from '@/lib/i18n'
import { toAppError } from '@/lib/errors'
import { getLinkInfo, postLoads } from '../api'
import { LoadFields } from '../components/LoadFields'
import { PublicFrame } from '../components/PublicFrame'
import { myLoads, rememberLoads, toProviderLoad } from '../lib/convert'
import { emptyLoad, formErrors, loadFormSchema, shipperSchema, type LoadForm } from '../lib/offer'

const WHO_KEY = 'spareway.provider'

function savedWho(): { name: string; phone: string } {
  try {
    return JSON.parse(localStorage.getItem(WHO_KEY) ?? '') as { name: string; phone: string }
  } catch {
    return { name: '', phone: '' }
  }
}

export default function ProviderPostPage() {
  const { token = '' } = useParams()
  const { t } = useLang('provider')
  const info = useQuery({
    queryKey: ['providerLink', token],
    queryFn: () => getLinkInfo(token),
    retry: false,
  })
  const [who, setWho] = useState(savedWho)
  const [whoErr, setWhoErr] = useState<Record<string, string>>({})
  const [loads, setLoads] = useState<LoadForm[]>([emptyLoad()])
  const [errs, setErrs] = useState<Record<string, string>[]>([{}])
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<{ code: string; shareToken: string }[] | null>(null)
  const earlier = myLoads()

  if (info.isLoading)
    return (
      <PublicFrame>
        <Skeleton className="h-40" />
        <Skeleton className="h-96" />
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

  const send = async () => {
    const w = shipperSchema.safeParse(who)
    const checks = loads.map((l) => loadFormSchema.safeParse(l))
    setWhoErr(formErrors(w))
    setErrs(checks.map(formErrors))
    if (!w.success || checks.some((c) => !c.success)) {
      toast.error(t('fixErrors'))
      return
    }
    setSending(true)
    try {
      const out = await postLoads(
        token,
        w.data,
        checks.map((c) => toProviderLoad(c.data!)),
      )
      try {
        localStorage.setItem(WHO_KEY, JSON.stringify(w.data))
      } catch {
        /* private window */
      }
      rememberLoads(out)
      setSent(out)
      setLoads([emptyLoad()])
      setErrs([{}])
    } catch (e) {
      toast.error(t(`common:errors.${toAppError(e).code}`))
    } finally {
      setSending(false)
    }
  }

  if (sent)
    return (
      <PublicFrame title={company.name}>
        <Card className="flex flex-col items-center gap-3 text-center">
          <CheckCircle2 size={48} className="text-ok" aria-hidden />
          <h1 className="text-page-title font-semibold">{t('sentTitle', { count: sent.length })}</h1>
          <p className="text-ink-2">{t('sentText', { company: company.name })}</p>
        </Card>
        <Card>
          <ul className="flex flex-col divide-y divide-line">
            {sent.map((s) => (
              <li key={s.shareToken} className="flex items-center justify-between gap-3 py-3">
                <span className="font-semibold">{s.code}</span>
                <Link
                  to={`/offer/${s.shareToken}`}
                  className="inline-flex h-12 items-center gap-2 rounded-control border border-line-strong bg-surface-2 px-4 font-semibold"
                >
                  <ExternalLink size={18} aria-hidden />
                  {t('openLoad')}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <PlainButton icon={Plus} onClick={() => setSent(null)}>
          {t('sendMore')}
        </PlainButton>
      </PublicFrame>
    )

  return (
    <PublicFrame title={t('title')} sub={t('to', { company: company.name })}>
      <p className="text-[18px] leading-7 text-ink-2">{t('intro', { company: company.name })}</p>

      {earlier.length > 0 && (
        <Card>
          <h2 className="mb-2 text-section-title font-semibold">{t('yourLoads')}</h2>
          <ul className="flex flex-wrap gap-2">
            {earlier.slice(0, 8).map((s) => (
              <li key={s.shareToken}>
                <Link
                  to={`/offer/${s.shareToken}`}
                  className="inline-flex h-11 items-center gap-1.5 rounded-control border border-line-strong bg-surface-2 px-3 font-semibold"
                >
                  {s.code}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="flex flex-col gap-4">
        <h2 className="text-section-title font-semibold">{t('who')}</h2>
        <TextField
          label={t('name')}
          value={who.name}
          error={whoErr.name ? t(whoErr.name) : undefined}
          onChange={(e) => setWho({ ...who, name: e.target.value })}
        />
        <TextField
          label={t('phone')}
          type="tel"
          inputMode="tel"
          placeholder="98270 12345"
          value={who.phone}
          error={whoErr.phone ? t(whoErr.phone) : undefined}
          onChange={(e) => setWho({ ...who, phone: e.target.value })}
        />
      </Card>

      {loads.map((l, i) => (
        <Card key={i} className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-section-title font-semibold">{t('loadN', { n: i + 1 })}</h2>
            {loads.length > 1 && (
              <PlainButton
                icon={Trash2}
                tone="danger"
                className="h-11"
                onClick={() => {
                  setLoads(loads.filter((_, j) => j !== i))
                  setErrs(errs.filter((_, j) => j !== i))
                }}
              >
                {t('remove')}
              </PlainButton>
            )}
          </div>
          <LoadFields
            value={l}
            errors={errs[i] ?? {}}
            onChange={(v) => setLoads(loads.map((x, j) => (j === i ? v : x)))}
          />
        </Card>
      ))}
      {loads.length < 10 && (
        <PlainButton
          icon={Plus}
          onClick={() => {
            // same pickup / drop as the last load: batches usually travel together
            const last = loads.at(-1)!
            setLoads([
              ...loads,
              {
                ...emptyLoad(),
                from: last.from,
                to: last.to,
                readyFrom: last.readyFrom,
                deliverBy: last.deliverBy,
              },
            ])
            setErrs([...errs, {}])
          }}
        >
          {t('addLoad')}
        </PlainButton>
      )}

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-line-strong bg-surface/95 backdrop-blur">
        <div className="mx-auto max-w-[640px] px-4 py-3">
          <MainButton icon={Send} size="lg" loading={sending} onClick={send} className="w-full">
            {t('send', { count: loads.length })}
          </MainButton>
        </div>
      </div>
    </PublicFrame>
  )
}
