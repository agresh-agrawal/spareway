// Owner side of load providers (stages 5 and 6): the provider link (QR / WhatsApp), the counter-offer sheet with
// the "Is ₹X worth it?" calculator, and a load's full details on the Loads page.
import { useMemo, useState } from 'react'
import { useLocation } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronDown, Copy, HandCoins, Megaphone, Phone, RefreshCw, Send, Undo2 } from 'lucide-react'
import {
  MainButton,
  NumberField,
  PlainButton,
  QrCard,
  QuickAction,
  Sheet,
  Skeleton,
  TextField,
} from '@/components/common'
import { useAuth } from '@/app/auth/AuthProvider'
import { useTrucks } from '@/features/trucks'
import { useLang } from '@/lib/i18n'
import { toAppError } from '@/lib/errors'
import { formatCargoSize, formatDate, formatDayTime, formatInr, formatKm, formatWeight } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Tables } from '@/types/database'
import { getProviderLink, listOffers, makeOffer, withdrawOffer, type Offer } from '../api'
import { offerWorth, roadKm } from '../lib/offer'

type Listing = Tables<'freight_listings'>

/** Home quick button → the Loads page with the provider link open. */
export function ProviderAction() {
  const { t } = useLang('provider')
  return <QuickAction to="/loads#providers" icon={Megaphone} label={t('owner.getLoads')} />
}

/** "Get loads from providers": one link for every provider; QR, WhatsApp, copy; new link. */
export function ProviderLinkButton() {
  const { t } = useLang('provider')
  const { hash } = useLocation()
  const [open, setOpen] = useState(hash === '#providers')
  const qc = useQueryClient()
  const link = useQuery({
    queryKey: ['providerLinkOwn'],
    queryFn: () => getProviderLink(false),
    enabled: open,
  })
  const fresh = useMutation({
    mutationFn: () => getProviderLink(true),
    onSuccess: (tok) => qc.setQueryData(['providerLinkOwn'], tok),
  })
  const url = link.data ? `${window.location.origin}/post/${link.data}` : ''
  return (
    <>
      <PlainButton icon={Megaphone} onClick={() => setOpen(true)} className="h-[52px]">
        {t('owner.getLoads')}
      </PlainButton>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={t('owner.linkTitle')}
        description={t('owner.linkText')}
      >
        {link.isLoading || !link.data ? (
          link.error ? (
            <p className="text-crit">{t(`common:errors.${toAppError(link.error).code}`)}</p>
          ) : (
            <Skeleton className="h-72" />
          )
        ) : (
          <div className="flex flex-col gap-4">
            <QrCard url={url} whatsappText={t('owner.whatsapp', { link: url })} />
            <PlainButton
              icon={RefreshCw}
              loading={fresh.isPending}
              onClick={() =>
                fresh.mutateAsync().catch((e) => toast.error(t(`common:errors.${toAppError(e).code}`)))
              }
            >
              {t('owner.newLink')}
            </PlainButton>
            <p className="text-label text-ink-2">{t('owner.newLinkHelp')}</p>
          </div>
        )}
      </Sheet>
    </>
  )
}

/** Offers on the listings shown (for the Loads page). */
export function useOffers(ids: string[]) {
  return useQuery({ queryKey: ['offers', ids], queryFn: () => listOffers(ids), enabled: ids.length > 0 })
}

/**
 * Counter-offer with the calculator. `needInr` (from the trip's evaluation) is used when known; otherwise the cost
 * is worked out for carrying the load on its own: road km × the fleet's usual cost per km + handling.
 */
export function CounterOfferSheet({
  listing,
  needInr,
  open,
  onOpenChange,
}: {
  listing: Pick<
    Listing,
    | 'id'
    | 'code'
    | 'offered_rate_inr'
    | 'pickup_lat'
    | 'pickup_lng'
    | 'drop_lat'
    | 'drop_lng'
    | 'weight_kg'
    | 'quantity'
  >
  needInr?: number
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const { t } = useLang('provider')
  const { settings } = useAuth()
  const trucks = useTrucks()
  const qc = useQueryClient()
  const perKm = useMemo(() => {
    const v = (trucks.data ?? [])
      .map((x) => Number(x.cost_per_km_inr))
      .filter((n) => n > 0)
      .sort((a, b) => a - b)
    return v.length ? v[Math.floor(v.length / 2)] : 30
  }, [trucks.data])
  const km = roadKm(
    { lat: listing.pickup_lat, lng: listing.pickup_lng },
    { lat: listing.drop_lat, lng: listing.drop_lng },
    Number(settings?.road_factor ?? 1.25),
  )
  const kg = Number(listing.weight_kg) * Number(listing.quantity)
  const [amount, setAmount] = useState(() => String(Math.round(needInr ?? listing.offered_rate_inr)))
  const [note, setNote] = useState('')
  const value = Number(amount)
  const own = offerWorth({
    km,
    costPerKmInr: perKm,
    kg,
    handlingInrPerKg: Number(settings?.handling_inr_per_kg ?? 0.5),
    minMarginInr: Number(settings?.min_margin_inr ?? 500),
    offerInr: Number.isFinite(value) ? value : 0,
  })
  const need = needInr ?? own.needInr
  const send = useMutation({
    mutationFn: () => makeOffer(listing.id, value, note),
    onSuccess: () => {
      toast.success(t('owner.offerSent', { code: listing.code }))
      void qc.invalidateQueries({ queryKey: ['offers'] })
      onOpenChange(false)
    },
    onError: (e) => toast.error(t(`common:errors.${toAppError(e).code}`)),
  })
  const bad = !(value > 0 && value <= 10_000_000)
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('owner.counterTitle', { code: listing.code })}
      footer={
        <MainButton
          icon={Send}
          size="lg"
          className="w-full"
          disabled={bad}
          loading={send.isPending}
          onClick={() => send.mutate()}
        >
          {t('owner.sendOffer')}
        </MainButton>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-ink-2">{t('owner.theyAsk', { inr: formatInr(listing.offered_rate_inr) })}</p>
        <NumberField
          label={t('owner.yourPrice')}
          unit="₹"
          inputMode="numeric"
          value={amount}
          error={bad ? t('err.price') : undefined}
          onChange={(e) => setAmount(e.target.value)}
        />
        <section
          className={cn(
            'rounded-tile border p-4',
            value >= need ? 'border-ok/50 bg-ok/[0.08]' : 'border-warn/50 bg-warn/[0.08]',
          )}
          aria-live="polite"
        >
          <h3 className="font-semibold">
            {t('owner.worthTitle', { inr: formatInr(Number.isFinite(value) ? value : 0) })}
          </h3>
          <p className="mt-1 text-[18px] font-semibold">
            {value >= need ? t('owner.worthYes') : t('owner.worthNo', { need: formatInr(need) })}
          </p>
          <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-ink-2 tabular">
            {needInr === undefined ? (
              <>
                <dt>{t('owner.calcKm')}</dt>
                <dd className="text-right">{formatKm(km)}</dd>
                <dt>{t('owner.calcCost', { perKm })}</dt>
                <dd className="text-right">{formatInr(own.costInr)}</dd>
              </>
            ) : (
              <>
                <dt>{t('owner.calcTrip')}</dt>
                <dd className="text-right">{formatInr(need)}</dd>
              </>
            )}
            <dt>{t('owner.calcNeed')}</dt>
            <dd className="text-right font-semibold text-ink">{formatInr(need)}</dd>
          </dl>
          {value < need && (
            <PlainButton icon={HandCoins} className="mt-3 h-11" onClick={() => setAmount(String(need))}>
              {t('owner.useNeed', { inr: formatInr(need) })}
            </PlainButton>
          )}
        </section>
        <TextField
          label={t('owner.note')}
          placeholder={t('owner.noteHint')}
          maxLength={200}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
    </Sheet>
  )
}

/** On the Loads page: the full details of a load, my offer's state, Counter-offer and the load's share link. */
export function ListingExtras({
  listing,
  offers,
  needInr,
}: {
  listing: Listing
  offers: Offer[]
  needInr?: number
}) {
  const { t, td, lang } = useLang('provider')
  const { company } = useAuth()
  const qc = useQueryClient()
  const [more, setMore] = useState(false)
  const [counter, setCounter] = useState(false)
  const mine = offers.filter((o) => o.listing_id === listing.id && o.status !== 'withdrawn')
  const myOwn = mine.filter((o) => o.company_id === company?.id || !company)
  const pending = myOwn.find((o) => o.status === 'pending')
  const withdraw = useMutation({
    mutationFn: (id: string) => withdrawOffer(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['offers'] }),
  })
  const shareUrl = listing.share_token ? `${window.location.origin}/offer/${listing.share_token}` : ''
  const open = listing.status === 'open'
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={more}
        onClick={() => setMore((m) => !m)}
        className="inline-flex min-h-10 items-center gap-1 self-start font-semibold text-ink-2 hover:text-ink"
      >
        {more ? t('owner.less') : t('owner.details')}
        <ChevronDown
          size={18}
          aria-hidden
          className={cn('transition-transform duration-200', more && 'rotate-180')}
        />
      </button>
      {more && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-tile border border-line bg-surface-2 p-3 text-[15px]">
          <dt className="text-ink-2">{t('share.pieces')}</dt>
          <dd className="tabular">
            {listing.quantity} × {formatCargoSize(listing.length_cm, listing.width_cm, listing.height_cm)} ·{' '}
            {formatWeight(Number(listing.weight_kg))}
          </dd>
          <dt className="text-ink-2">{t('share.weight')}</dt>
          <dd className="tabular">{formatWeight(Number(listing.weight_kg) * listing.quantity)}</dd>
          {listing.fragile && (
            <>
              <dt className="text-ink-2">{t('form.fragile')}</dt>
              <dd className="text-warn">{t('share.yes')}</dd>
            </>
          )}
          {listing.deliver_by && (
            <>
              <dt className="text-ink-2">{t('form.deliverBy')}</dt>
              <dd>{formatDate(listing.deliver_by, lang)}</dd>
            </>
          )}
          <dt className="text-ink-2">{t('owner.shipper')}</dt>
          <dd>
            {td(listing.shipper_name)}
            {listing.shipper_phone && (
              <a
                href={`tel:${listing.shipper_phone.replace(/\s/g, '')}`}
                className="ml-2 inline-flex items-center gap-1 font-semibold text-accent"
              >
                <Phone size={14} aria-hidden />
                {listing.shipper_phone}
              </a>
            )}
          </dd>
          {listing.description && (
            <>
              <dt className="text-ink-2">{t('form.note')}</dt>
              <dd>{td(listing.description)}</dd>
            </>
          )}
        </dl>
      )}
      {myOwn.map((o) => (
        <p key={o.id} className="text-[15px]">
          <span className="font-semibold">
            {t('owner.yourOffer', { inr: formatInr(Number(o.amount_inr)) })}
          </span>{' '}
          <span
            className={
              o.status === 'accepted' ? 'text-ok' : o.status === 'rejected' ? 'text-ink-2' : 'text-accent'
            }
          >
            {t(`share.offerStatus.${o.status}`)}
          </span>
          <span className="text-ink-2"> · {formatDayTime(o.created_at, lang)}</span>
        </p>
      ))}
      <div className="flex flex-wrap gap-2">
        {open && !pending && (
          <PlainButton icon={HandCoins} onClick={() => setCounter(true)} className="flex-1">
            {t('owner.counter')}
          </PlainButton>
        )}
        {pending && (
          <PlainButton
            icon={Undo2}
            loading={withdraw.isPending}
            onClick={() => withdraw.mutate(pending.id)}
            className="flex-1"
          >
            {t('owner.withdraw')}
          </PlainButton>
        )}
        {shareUrl && (
          <PlainButton
            icon={Copy}
            onClick={() =>
              void navigator.clipboard
                .writeText(shareUrl)
                .then(() => toast.success(t('owner.copied')))
                .catch(() => toast(shareUrl))
            }
          >
            {t('owner.copyLink')}
          </PlainButton>
        )}
      </div>
      {counter && (
        <CounterOfferSheet listing={listing} needInr={needInr} open={counter} onOpenChange={setCounter} />
      )}
    </div>
  )
}
