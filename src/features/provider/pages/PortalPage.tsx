// /my-loads/:portal — a trader's or shipper's own page, no login: all their loads with status and offers, and
// "Upload loads". Traders and shippers see their own wording (goods to buyers vs. their own shipments).
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronRight, Copy, HandCoins, LinkIcon, PackagePlus, Send, Upload } from 'lucide-react'
import { Card, EmptyState, MainButton, PlainButton, Skeleton } from '@/components/common'
import { useLang } from '@/lib/i18n'
import { formatDate, formatInr, formatWeight } from '@/lib/format'
import { cn } from '@/lib/cn'
import { getPortal, postFromPortal } from '../api'
import { PublicFrame } from '../components/PublicFrame'
import { UploadLoads } from '../components/UploadLoads'
import { rememberLoads } from '../lib/convert'

const STATUS_TONE: Record<string, string> = { open: 'text-ok', reserved: 'text-accent', accepted: 'text-accent', expired: 'text-ink-2' }

export default function PortalPage() {
  const { portal = '' } = useParams()
  const { t, td, lang } = useLang('provider')
  const qc = useQueryClient()
  const key = ['portal', portal]
  const q = useQuery({ queryKey: key, queryFn: () => getPortal(portal), refetchInterval: 30_000, retry: false })
  const [tab, setTab] = useState<'loads' | 'upload'>('loads')

  if (q.isLoading)
    return (
      <PublicFrame>
        <Skeleton className="h-28" />
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
          <h1 className="text-[26px] leading-8 font-semibold">{t('portal.notFound')}</h1>
        </div>
      </PublicFrame>
    )

  const { provider, company, loads } = q.data
  const k = provider.kind
  const open = loads.filter((l) => l.status === 'open')
  const agreed = loads.filter((l) => l.status === 'reserved' || l.status === 'accepted')
  const waiting = loads.reduce((a, l) => a + l.offersWaiting, 0)
  const pageUrl = window.location.href

  return (
    <PublicFrame title={provider.name} sub={t(`portal.${k}.sub`, { company: company.name })}>
      <div className="grid grid-cols-3 gap-2">
        {[
          [open.length, t('portal.tiles.open')],
          [waiting, t('portal.tiles.offers')],
          [agreed.length, t('portal.tiles.agreed')],
        ].map(([n, label]) => (
          <div key={String(label)} className={cn('rounded-tile border bg-surface p-3', label === t('portal.tiles.offers') && Number(n) > 0 ? 'border-accent' : 'border-line')}>
            <div className="text-[28px] leading-9 font-semibold tabular">{n}</div>
            <div className="text-label text-ink-2">{label}</div>
          </div>
        ))}
      </div>

      <div role="tablist" className="grid grid-cols-2 gap-1 rounded-control border border-line-strong bg-surface-2 p-1">
        {(['loads', 'upload'] as const).map((id) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn('h-12 rounded-[10px] text-[17px] font-semibold', tab === id ? 'bg-surface text-ink shadow-sm' : 'text-ink-2')}
          >
            {t(`portal.${k}.${id}`)}
          </button>
        ))}
      </div>

      {tab === 'loads' ? (
        loads.length === 0 ? (
          <EmptyState
            icon={PackagePlus}
            text={t(`portal.${k}.empty`)}
            action={
              <MainButton icon={Upload} onClick={() => setTab('upload')}>
                {t(`portal.${k}.upload`)}
              </MainButton>
            }
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {loads.map((l) => (
              <li key={l.shareToken}>
                <Link to={`/offer/${l.shareToken}`} className="block">
                  <Card className={cn('flex items-center gap-3 transition-colors hover:bg-surface-2', l.offersWaiting > 0 && 'border-accent')}>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-[18px] font-semibold">{td(l.goods)}</span>
                        <span className={cn('font-semibold', STATUS_TONE[l.status] ?? 'text-ink')}>{t(`share.status.${l.status}`)}</span>
                      </div>
                      <p className="text-ink-2">
                        {td(l.pickupName)} → {td(l.dropName)} · {l.code}
                      </p>
                      <p className="text-ink-2 tabular">
                        {l.quantity} × {formatWeight(l.weightKg)} · {formatInr(l.priceInr)}
                        {l.readyFrom ? ` · ${t('portal.ready', { date: formatDate(l.readyFrom, lang) })}` : ''}
                      </p>
                      {l.offersWaiting > 0 && (
                        <p className="mt-1 inline-flex items-center gap-1.5 font-semibold text-accent">
                          <HandCoins size={18} aria-hidden />
                          {t('portal.offersWaiting', { count: l.offersWaiting, inr: formatInr(l.bestOffer ?? 0) })}
                        </p>
                      )}
                    </div>
                    <ChevronRight size={20} className="shrink-0 text-ink-3" aria-hidden />
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : (
        <UploadLoads
          goodsHint={t(`portal.${k}.goodsHint`)}
          onSend={async (list) => {
            const out = await postFromPortal(portal, list)
            rememberLoads(out)
            toast.success(t('sentTitle', { count: out.length }))
            await qc.invalidateQueries({ queryKey: key })
            setTab('loads')
          }}
        />
      )}

      {tab === 'loads' && (
        <Card className="flex flex-col gap-3">
          <p className="text-ink-2">{t('portal.keepLink')}</p>
          <div className="grid grid-cols-2 gap-2">
            <PlainButton
              icon={Copy}
              onClick={() =>
                void navigator.clipboard
                  .writeText(pageUrl)
                  .then(() => toast.success(t('owner.copied')))
                  .catch(() => toast(pageUrl))
              }
            >
              {t('portal.copy')}
            </PlainButton>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(t('portal.whatsappSelf', { link: pageUrl }))}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-[52px] items-center justify-center gap-2 rounded-control border border-line-strong bg-surface-2 font-semibold"
            >
              <Send size={18} aria-hidden />
              {t('portal.whatsapp')}
            </a>
          </div>
        </Card>
      )}
    </PublicFrame>
  )
}
