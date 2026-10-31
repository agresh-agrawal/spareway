import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { AlertTriangle, Boxes, PowerOff, RefreshCw, Send } from 'lucide-react'
import {
  Bar,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  MainButton,
  PlainButton,
  QrCard,
  SkeletonList,
} from '@/components/common'
import { useTrip } from '@/features/trips'
import { useLang } from '@/lib/i18n'
import { toAppError } from '@/lib/errors'
import { formatDateTime } from '@/lib/format'
import { useCreateLink, useDisableLink, useLinkState, useLoaderAlerts, useLoadingProgress } from '../hooks'
import { markLoaderStep } from '../lib/stepState'

/** Trip step 3 "Loader" (Architecture F13, Design System 7.8). */
export function LoaderStep({ tripId }: { tripId: string }) {
  const { t, tm, lang } = useLang('loader')
  const [, setParams] = useSearchParams()
  const trip = useTrip(tripId)
  const link = useLinkState(tripId)
  const create = useCreateLink(tripId)
  const disable = useDisableLink(tripId)
  const planId = trip.data?.overview.active_plan_id ?? null
  const progress = useLoadingProgress(planId)
  const alerts = useLoaderAlerts(tripId)
  const [confirmOff, setConfirmOff] = useState(false)

  const l = link.data
  const live = Boolean(l?.token && l.enabled && l.expiresAt && new Date(l.expiresAt) > new Date())
  const status = trip.data?.trip.status

  useEffect(() => {
    markLoaderStep(tripId, live || (progress.data ? progress.data.done > 0 : false) || (status !== undefined && status !== 'planned'))
  }, [tripId, live, progress.data, status])

  if (trip.isLoading || link.isLoading) return <SkeletonList rows={3} />
  if (trip.error) return <ErrorState error={trip.error} onRetry={() => trip.refetch()} />
  if (link.error) return <ErrorState error={link.error} onRetry={() => link.refetch()} />

  const code = trip.data!.trip.code
  const url = l?.token ? `${window.location.origin}/load/${l.token}` : ''
  const when = l?.expiresAt ? formatDateTime(l.expiresAt, lang) : ''

  const makeLink = async () => {
    try {
      await create.mutateAsync()
      toast.success(t('created'))
    } catch (e) {
      toast.error(t(`common:errors.${toAppError(e).code}`))
    }
  }
  const turnOff = async () => {
    try {
      await disable.mutateAsync()
      toast.success(t('turnedOff'))
      setConfirmOff(false)
    } catch (e) {
      toast.error(t(`common:errors.${toAppError(e).code}`))
    }
  }

  if (!planId)
    return (
      <EmptyState
        icon={Boxes}
        text={t('planFirst')}
        action={
          <PlainButton icon={Boxes} onClick={() => setParams({ step: 'load-plan' }, { replace: true })}>
            {t('openPlan')}
          </PlainButton>
        }
      />
    )

  const p = progress.data
  const loaderAlerts = alerts.data ?? []

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
      <Card>
        <CardHeader icon={Send} title={t('send')} />
        {live ? (
          <div className="flex flex-col gap-4">
            <QrCard url={url} whatsappText={t('whatsapp', { code, link: url, when })} />
            <p className="text-center font-medium text-ink-2">{t('validTill', { when })}</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <PlainButton icon={PowerOff} onClick={() => setConfirmOff(true)} className="flex-1">
                {t('turnOff')}
              </PlainButton>
              <PlainButton icon={RefreshCw} onClick={makeLink} loading={create.isPending} className="flex-1">
                {t('newLink')}
              </PlainButton>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-ink-2">{l?.token ? t('ended') : t('sendText')}</p>
            <MainButton icon={Send} onClick={makeLink} loading={create.isPending} className="w-full">
              {l?.token ? t('newLink') : t('send')}
            </MainButton>
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-4">
        {progress.isLoading ? (
          <SkeletonList rows={2} />
        ) : progress.error ? (
          <ErrorState error={progress.error} onRetry={() => progress.refetch()} />
        ) : (
          p && <Bar label={t('progress', { done: p.done, total: p.total })} pct={p.total ? (100 * p.done) / p.total : 0} />
        )}
        <div>
          <h3 className="mb-2 flex items-center gap-2 font-semibold">
            <AlertTriangle size={20} className={loaderAlerts.length || p?.issues.length ? 'text-crit' : 'text-ink-3'} aria-hidden />
            {loaderAlerts.length ? t('problems', { count: loaderAlerts.length }) : t('noProblems')}
          </h3>
          <ul className="flex flex-col gap-2">
            {loaderAlerts.map((a) => (
              <li key={a.id} className="rounded-tile border border-crit/30 bg-crit/[0.06] p-3 text-crit">
                {tm(a.kind, a.meta as Record<string, unknown>, a.message)}
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmOff}
        onOpenChange={setConfirmOff}
        title={t('turnOffTitle')}
        text={t('turnOffText')}
        confirmLabel={t('turnOff')}
        confirmIcon={PowerOff}
        onConfirm={turnOff}
        loading={disable.isPending}
      />
    </div>
  )
}
