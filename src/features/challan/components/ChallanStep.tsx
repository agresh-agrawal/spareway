// Trip step "Challan corner" (owner request 4): what could bring a challan on this trip, the papers and habits
// with the usual fines, and the trip's extra costs (challans, breakdowns…) that come off the net earnings.
import { useMemo, useState } from 'react'
import { BookOpen, Plus, ReceiptIndianRupee, ShieldAlert, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardHeader, ErrorState, MainButton, Skeleton } from '@/components/common'
import { useLang } from '@/lib/i18n'
import { toAppError } from '@/lib/errors'
import { formatDayTime, formatInr } from '@/lib/format'
import { useChallanTrip, useExpenseMutations, useTripExpenses } from '../hooks'
import { challanRisks } from '../lib/risks'
import { CostSheet } from './CostForm'
import { FineGuide, RiskList } from './RiskList'

export function ChallanStep({ tripId }: { tripId: string }) {
  const { t, td, lang } = useLang('challan')
  const trip = useChallanTrip(tripId)
  const costs = useTripExpenses(tripId)
  const { add, remove } = useExpenseMutations(tripId)
  const [open, setOpen] = useState(false)
  const risks = useMemo(() => (trip.data ? challanRisks(trip.data) : []), [trip.data])

  if (trip.error) return <ErrorState error={trip.error} onRetry={() => void trip.refetch()} />
  if (!trip.data || !costs.data)
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
      </div>
    )
  const total = costs.data.reduce((a, e) => a + Number(e.amount_inr), 0)

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader icon={ShieldAlert} title={t('risks.title')} />
          <RiskList risks={risks} />
          <p className="mt-3 text-ink-2">{t('risks.driverSees')}</p>
        </Card>
        <Card>
          <CardHeader
            icon={ReceiptIndianRupee}
            title={t('costs.title')}
            action={
              <MainButton icon={Plus} onClick={() => setOpen(true)} className="h-11">
                {t('costs.add')}
              </MainButton>
            }
          />
          {costs.data.length === 0 ? (
            <p className="text-ink-2">{t('costs.none')}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {costs.data.map((e) => (
                <li key={e.id} className="flex items-center gap-3 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{t(`common:costKinds.${e.kind}`)}</span>
                    <span className="block truncate text-label text-ink-2">
                      {e.added_by === 'driver' ? t('costs.byDriver') : t('costs.byYou')} · {formatDayTime(e.created_at, lang)}
                      {e.note ? ` · ${td(e.note)}` : ''}
                    </span>
                  </span>
                  <span className="font-semibold tabular">{formatInr(Number(e.amount_inr))}</span>
                  <button
                    type="button"
                    aria-label={t('costs.remove')}
                    onClick={() => remove.mutate(e.id, { onError: (err) => toast.error(t(`common:errors.${toAppError(err).code}`)) })}
                    className="flex size-10 items-center justify-center rounded-full text-ink-2 hover:bg-surface-3 hover:text-crit"
                  >
                    <Trash2 size={18} />
                  </button>
                </li>
              ))}
              <li className="flex items-center justify-between pt-3 font-semibold">
                <span>{t('costs.total')}</span>
                <span className="text-crit tabular">− {formatInr(total)}</span>
              </li>
            </ul>
          )}
          <p className="mt-3 text-label text-ink-2">{t('costs.inEarnings')}</p>
        </Card>
      </div>
      <Card>
        <CardHeader icon={BookOpen} title={t('guide.title')} />
        <FineGuide />
      </Card>
      <CostSheet open={open} onOpenChange={setOpen} onSave={(kind, amountInr, note) => add.mutateAsync({ kind, amountInr, note })} />
    </div>
  )
}
