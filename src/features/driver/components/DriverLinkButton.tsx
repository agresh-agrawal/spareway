import { useState } from 'react'
import { Power, RefreshCw, Route as RouteIcon } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ConfirmDialog, MainButton, PlainButton, QrCard, Sheet, Skeleton } from '@/components/common'
import { useLang } from '@/lib/i18n'
import { toAppError } from '@/lib/errors'
import { queryKeys } from '@/lib/queryKeys'
import { useTrip } from '@/features/trips'
import { createDriverLink, disableDriverLink, getDriverLinkState } from '../api'

/** Trip page action "Driver link": QR + WhatsApp + copy; new link / turn off (slot trip.actions). */
export function DriverLinkButton({ tripId }: { tripId: string }) {
  const { t } = useLang('driver')
  const qc = useQueryClient()
  const trip = useTrip(tripId)
  const [open, setOpen] = useState(false)
  const [confirmOff, setConfirmOff] = useState(false)
  const key = [...queryKeys.trip(tripId), 'driverLink']
  const state = useQuery({ queryKey: key, queryFn: () => getDriverLinkState(tripId), enabled: open })
  const done = () => qc.invalidateQueries({ queryKey: key })
  const create = useMutation({ mutationFn: () => createDriverLink(tripId), onSuccess: done })
  const off = useMutation({ mutationFn: () => disableDriverLink(tripId), onSuccess: done })
  const err = (e: unknown) => toast.error(t(`common:errors.${toAppError(e).code}`))

  const link = state.data?.enabled && state.data.token ? `${window.location.origin}/drive/${state.data.token}` : null
  const code = trip.data?.trip.code ?? ''

  return (
    <>
      <PlainButton icon={RouteIcon} onClick={() => setOpen(true)} className="h-[52px] px-5">
        {t('button')}
      </PlainButton>
      <Sheet open={open} onOpenChange={setOpen} title={t('sheetTitle')} description={t('sheetText')}>
        {state.isLoading ? (
          <Skeleton className="h-72" />
        ) : link ? (
          <div className="flex flex-col gap-4">
            <QrCard url={link} whatsappText={t('whatsapp', { code, link })} />
            <div className="grid grid-cols-2 gap-2">
              <PlainButton icon={RefreshCw} loading={create.isPending} onClick={() => create.mutateAsync().catch(err)}>
                {t('newLink')}
              </PlainButton>
              <PlainButton icon={Power} tone="danger" onClick={() => setConfirmOff(true)}>
                {t('turnOff')}
              </PlainButton>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-ink-2">{t('noLink')}</p>
            <MainButton icon={RouteIcon} loading={create.isPending} onClick={() => create.mutateAsync().catch(err)}>
              {t('create')}
            </MainButton>
          </div>
        )}
      </Sheet>
      <ConfirmDialog
        open={confirmOff}
        onOpenChange={setConfirmOff}
        title={t('turnOffTitle')}
        text={t('turnOffText')}
        confirmLabel={t('turnOff')}
        loading={off.isPending}
        onConfirm={() => off.mutateAsync().then(() => setConfirmOff(false)).catch(err)}
      />
    </>
  )
}
