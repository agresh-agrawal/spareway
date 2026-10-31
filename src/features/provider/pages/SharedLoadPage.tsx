// /offer/:share — one load's own page, no login (stage 5): status, details, counter-offers from truck owners with
// Accept / Turn down, change the load while open, take it off, share the link.
import { useState } from 'react'
import { useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Ban, Check, LinkIcon, Pencil, Phone, Save, Send, X } from 'lucide-react'
import {
  Card,
  CardHeader,
  ConfirmDialog,
  MainButton,
  PlainButton,
  Sheet,
  Skeleton,
} from '@/components/common'
import { useLang } from '@/lib/i18n'
import { toAppError } from '@/lib/errors'
import { formatCargoSize, formatDate, formatDayTime, formatInr, formatWeight } from '@/lib/format'
import { cn } from '@/lib/cn'
import { answerOffer, cancelSharedLoad, getSharedLoad, updateSharedLoad } from '../api'
import { LoadFields } from '../components/LoadFields'
import { PublicFrame } from '../components/PublicFrame'
import { toForm, toProviderLoad } from '../lib/convert'
import { formErrors, loadFormSchema, type LoadForm } from '../lib/offer'

const STATUS_TONE: Record<string, string> = {
  open: 'text-ok',
  reserved: 'text-accent',
  accepted: 'text-accent',
  expired: 'text-ink-2',
}

export default function SharedLoadPage() {
  const { share = '' } = useParams()
  const { t, td, lang } = useLang('provider')
  const qc = useQueryClient()
  const key = ['sharedLoad', share]
  const q = useQuery({
    queryKey: key,
    queryFn: () => getSharedLoad(share),
    refetchInterval: 30_000,
    retry: false,
  })
  const [editing, setEditing] = useState<LoadForm | null>(null)
  const [editErr, setEditErr] = useState<Record<string, string>>({})
  const [cancelOpen, setCancelOpen] = useState(false)
  const refresh = () => qc.invalidateQueries({ queryKey: key })
  const onErr = (e: unknown) => toast.error(t(`common:errors.${toAppError(e).code}`))
  const answer = useMutation({
    mutationFn: (v: { id: string; accept: boolean }) => answerOffer(share, v.id, v.accept),
    onSuccess: (_r, v) => {
      toast.success(v.accept ? t('share.acceptedToast') : t('share.declinedToast'))
      void refresh()
    },
    onError: onErr,
  })
  const save = useMutation({
    mutationFn: (v: LoadForm) => updateSharedLoad(share, toProviderLoad(loadFormSchema.parse(v))),
    onSuccess: () => {
      toast.success(t('share.saved'))
      setEditing(null)
      void refresh()
    },
    onError: onErr,
  })
  const cancel = useMutation({
    mutationFn: () => cancelSharedLoad(share),
    onSuccess: () => {
      setCancelOpen(false)
      void refresh()
    },
    onError: onErr,
  })

  if (q.isLoading)
    return (
      <PublicFrame>
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </PublicFrame>
    )
  if (q.error || !q.data)
    return (
      <PublicFrame>
        <div className="mt-10 flex flex-col items-center gap-4 text-center">
          <span className="flex size-20 items-center justify-center rounded-full bg-crit/15 text-crit">
            <LinkIcon size={40} aria-hidden />
          </span>
          <h1 className="text-[26px] leading-8 font-semibold">{t('share.notFound')}</h1>
        </div>
      </PublicFrame>
    )

  const { load: l, offers, sharedBy } = q.data
  const open = l.status === 'open'
  const link = window.location.href
  const pending = offers.filter((o) => o.status === 'pending')

  return (
    <PublicFrame title={l.code} sub={t('share.postedFor', { company: sharedBy.name })}>
      <Card>
        <p className={cn('text-[20px] font-semibold', STATUS_TONE[l.status] ?? 'text-ink')}>
          {t(`share.status.${l.status}`)}
        </p>
        <h1 className="mt-1 text-page-title font-semibold">{td(l.goods)}</h1>
        <p className="mt-1 text-[18px] text-ink-2">
          {td(l.pickupName)} → {td(l.dropName)}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-[17px]">
          <div>
            <dt className="text-label text-ink-2">{t('share.pieces')}</dt>
            <dd className="font-semibold tabular">
              {l.quantity} × {formatCargoSize(l.lengthCm, l.widthCm, l.heightCm)}
            </dd>
          </div>
          <div>
            <dt className="text-label text-ink-2">{t('share.weight')}</dt>
            <dd className="font-semibold tabular">{formatWeight(l.weightKg * l.quantity)}</dd>
          </div>
          <div>
            <dt className="text-label text-ink-2">{t('share.price')}</dt>
            <dd className="font-semibold tabular">{formatInr(l.priceInr)}</dd>
          </div>
          <div>
            <dt className="text-label text-ink-2">{t('share.ready')}</dt>
            <dd className="font-semibold">{l.readyFrom ? formatDate(l.readyFrom, lang) : '—'}</dd>
          </div>
          {l.deliverBy && (
            <div>
              <dt className="text-label text-ink-2">{t('form.deliverBy')}</dt>
              <dd className="font-semibold">{formatDate(l.deliverBy, lang)}</dd>
            </div>
          )}
          {l.fragile && (
            <div>
              <dt className="text-label text-ink-2">{t('form.fragile')}</dt>
              <dd className="font-semibold text-warn">{t('share.yes')}</dd>
            </div>
          )}
        </dl>
        {l.note && <p className="mt-3 text-ink-2">{td(l.note)}</p>}
      </Card>

      <Card>
        <CardHeader icon={Send} title={t('share.offers')} />
        {offers.length === 0 ? (
          <p className="text-ink-2">{t('share.noOffers')}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {offers.map((o) => (
              <li key={o.id} className="rounded-tile border border-line bg-surface-2 p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-[24px] font-semibold tabular">{formatInr(o.amount)}</span>
                  <span
                    className={cn(
                      'font-semibold',
                      o.status === 'accepted'
                        ? 'text-ok'
                        : o.status === 'rejected'
                          ? 'text-ink-2'
                          : 'text-accent',
                    )}
                  >
                    {t(`share.offerStatus.${o.status}`)}
                  </span>
                </div>
                <p className="text-ink-2">
                  {o.company} · {formatDayTime(o.at, lang)}
                </p>
                {o.note && <p className="mt-1">{o.note}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {o.status === 'pending' && open && (
                    <>
                      <MainButton
                        icon={Check}
                        loading={answer.isPending && answer.variables?.id === o.id && answer.variables.accept}
                        onClick={() => answer.mutate({ id: o.id, accept: true })}
                        className="flex-1"
                      >
                        {t('share.accept')}
                      </MainButton>
                      <PlainButton
                        icon={X}
                        onClick={() => answer.mutate({ id: o.id, accept: false })}
                        className="flex-1"
                      >
                        {t('share.decline')}
                      </PlainButton>
                    </>
                  )}
                  {o.phone && (
                    <a
                      href={`tel:${o.phone.replace(/\s/g, '')}`}
                      className="inline-flex h-12 items-center gap-2 rounded-control border border-line-strong bg-surface px-4 font-semibold"
                    >
                      <Phone size={18} aria-hidden />
                      {t('share.call')}
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {pending.length > 0 && <p className="mt-3 text-label text-ink-2">{t('share.acceptNote')}</p>}
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(t('share.whatsapp', { code: l.code, goods: td(l.goods), from: td(l.pickupName), to: td(l.dropName), link }))}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-14 items-center justify-center gap-2 rounded-control border border-line-strong bg-surface-2 text-[17px] font-semibold"
        >
          <Send size={20} aria-hidden />
          {t('share.shareLink')}
        </a>
        {sharedBy.phone ? (
          <a
            href={`tel:${sharedBy.phone.replace(/\s/g, '')}`}
            className="inline-flex h-14 items-center justify-center gap-2 rounded-control border border-line-strong bg-surface-2 text-[17px] font-semibold"
          >
            <Phone size={20} aria-hidden />
            {t('share.callOwner', { company: sharedBy.name })}
          </a>
        ) : (
          <span />
        )}
        {open && (
          <PlainButton
            icon={Pencil}
            className="h-14 text-[17px]"
            onClick={() => {
              setEditErr({})
              setEditing(toForm(l))
            }}
          >
            {t('share.change')}
          </PlainButton>
        )}
        {(open || l.status === 'reserved') && (
          <PlainButton
            icon={Ban}
            tone="danger"
            className="h-14 text-[17px]"
            onClick={() => setCancelOpen(true)}
          >
            {t('share.takeOff')}
          </PlainButton>
        )}
      </div>

      <Sheet
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={t('share.change')}
        footer={
          <MainButton
            icon={Save}
            size="lg"
            className="w-full"
            loading={save.isPending}
            onClick={() => {
              if (!editing) return
              const r = loadFormSchema.safeParse(editing)
              setEditErr(formErrors(r))
              if (r.success) save.mutate(editing)
            }}
          >
            {t('share.save')}
          </MainButton>
        }
      >
        {editing && <LoadFields value={editing} errors={editErr} onChange={setEditing} />}
      </Sheet>
      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={t('share.takeOffTitle')}
        text={t('share.takeOffText')}
        confirmLabel={t('share.takeOff')}
        confirmIcon={Ban}
        loading={cancel.isPending}
        onConfirm={() => cancel.mutate()}
      />
    </PublicFrame>
  )
}
