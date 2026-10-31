// /loads (F20, Design System 7.14): Open · Taken · All, load cards with Demo / Public badges,
// "Find a trip for this load", remove my own open posts; lime "Post a load".
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { MapPinned, Plus, Trash2 } from 'lucide-react'
import { Badge, ConfirmDialog, EmptyState, ErrorState, PageHeader, PlainButton, SkeletonList, StatusChip } from '@/components/common'
import { useAuth } from '@/app/auth/AuthProvider'
import { formatDate, formatInr, formatWeight } from '@/lib/format'
import { useLang } from '@/lib/i18n'
import { toAppError } from '@/lib/errors'
import { cn } from '@/lib/cn'
import { myCompanyId, type ListingFilter, type ListingRow } from '../api'
import { bestTripFor, useListings, usePlannableTrips, useRemoveListing } from '../hooks'

const FILTERS: ListingFilter[] = ['open', 'taken', 'all']

export default function LoadsPage() {
  const { t, td, lang } = useLang('extra-loads')
  const { company } = useAuth()
  const me = myCompanyId(company?.id)
  const [filter, setFilter] = useState<ListingFilter>('open')
  const list = useListings(filter)
  const trips = usePlannableTrips()
  const remove = useRemoveListing()
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState<ListingRow | null>(null)

  const findTrip = (l: ListingRow) => {
    const id = trips.data ? bestTripFor(l, trips.data) : null
    if (id) navigate(`/trips/${id}?step=extra-loads`)
    else toast(t('loads.noTrip'))
  }
  const doRemove = async () => {
    if (!confirm) return
    try {
      await remove.mutateAsync(confirm.id)
      toast.success(t('loads.removed'))
      setConfirm(null)
    } catch (err) {
      toast.error(t(`common:errors.${toAppError(err).code}`))
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col">
      <PageHeader
        title={t('loads.title')}
        subtitle={list.data ? t('loads.count', { count: list.data.length }) : undefined}
        actions={
          <Link
            to="/loads/new"
            className="inline-flex h-[52px] items-center gap-2 rounded-control bg-accent px-5 text-button font-semibold text-accent-ink hover:brightness-95"
          >
            <Plus size={20} aria-hidden />
            {t('loads.post')}
          </Link>
        }
      />
      <div role="group" className="scrollbar-none -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              'h-10 shrink-0 rounded-full border px-4 font-semibold transition-colors duration-200',
              filter === f ? 'border-accent bg-accent-soft text-ink' : 'border-line-strong bg-surface-2 text-ink-2 hover:bg-surface-3',
            )}
          >
            {t(`loads.filter.${f}`)}
          </button>
        ))}
      </div>
      {list.isLoading ? (
        <SkeletonList rows={4} />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : !list.data?.length ? (
        <EmptyState icon={MapPinned} text={t('loads.empty')} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.data.map((l) => {
            const mine = l.company_id === me
            const open = l.status === 'open' || l.status === 'reserved'
            const kg = Number(l.weight_kg) * Number(l.quantity)
            const ready = l.ready_from && new Date(l.ready_from).getTime() > Date.now() ? t('loads.ready', { date: formatDate(l.ready_from, lang) }) : t('loads.readyNow')
            return (
              <article key={l.id} aria-label={l.code} className="flex min-w-0 flex-col gap-2 rounded-card border border-line bg-surface p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-label font-semibold text-ink-2">{l.code}</span>
                  {l.is_sample && <Badge kind="demo" />}
                  {l.visibility === 'public' && <Badge kind="public" />}
                  {mine && !l.is_sample && <StatusChip tone="info">{t('loads.mine')}</StatusChip>}
                  {!open && <StatusChip tone="neutral">{t('loads.taken')}</StatusChip>}
                </div>
                <h3 className="text-section-title font-semibold">{t('loads.card', { from: td(l.pickup_name), to: td(l.drop_name) })}</h3>
                <p className="text-ink-2 tabular">{t('loads.line', { goods: td(l.goods_type), kg: formatWeight(kg), offer: formatInr(l.offered_rate_inr) })}</p>
                <p className="text-label text-ink-2">{ready}</p>
                {open && (
                  <div className="mt-auto flex flex-wrap gap-2 pt-2">
                    <PlainButton icon={MapPinned} onClick={() => findTrip(l)} className="flex-1">
                      {t('loads.findTrip')}
                    </PlainButton>
                    {mine && !l.is_sample && (
                      <PlainButton icon={Trash2} tone="danger" onClick={() => setConfirm(l)}>
                        {t('loads.remove')}
                      </PlainButton>
                    )}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t('loads.removeTitle', { code: confirm?.code ?? '' })}
        text={t('loads.removeText')}
        confirmLabel={t('loads.remove')}
        confirmIcon={Trash2}
        onConfirm={() => void doRemove()}
        loading={remove.isPending}
      />
    </div>
  )
}
