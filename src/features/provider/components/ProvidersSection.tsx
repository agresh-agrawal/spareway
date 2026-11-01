// Settings: every trader / shipper who joined through the provider link. Block stops their page at once (new
// portal token), takes their open loads off the market and refuses the same mobile on the link again.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Ban, Phone, Undo2, Users } from 'lucide-react'
import { Card, CardHeader, PlainButton, Skeleton } from '@/components/common'
import { useLang } from '@/lib/i18n'
import { toAppError } from '@/lib/errors'
import { cn } from '@/lib/cn'
import { blockProvider, listProviders } from '../api'

export function ProvidersSection() {
  const { t } = useLang('provider')
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['providers'], queryFn: listProviders })
  const block = useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) => blockProvider(id, on),
    onSuccess: (_v, { on }) => {
      toast.success(on ? t('list.blocked') : t('list.unblocked'))
      void qc.invalidateQueries({ queryKey: ['providers'] })
      void qc.invalidateQueries({ queryKey: ['loads'] })
    },
    onError: (e) => toast.error(t(`common:errors.${toAppError(e).code}`)),
  })
  return (
    <Card>
      <CardHeader icon={Users} title={t('list.title')} />
      <p className="mb-4 text-ink-2">{t('list.text')}</p>
      {q.isLoading ? (
        <Skeleton className="h-16" />
      ) : (q.data ?? []).length === 0 ? (
        <p className="text-ink-3">{t('list.empty')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {(q.data ?? []).map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div className="min-w-0">
                <p className={cn('font-semibold', p.blocked && 'text-ink-3 line-through')}>{p.name}</p>
                <p className="flex items-center gap-1.5 text-label text-ink-2">
                  {t(`join.${p.kind === 'trader' ? 'trader' : 'shipper'}`)} ·
                  <Phone size={14} aria-hidden />
                  <a href={`tel:${p.phone}`} className="tabular underline-offset-2 hover:underline">
                    {p.phone}
                  </a>
                  {p.blocked && <span className="font-medium text-crit"> · {t('list.isBlocked')}</span>}
                </p>
              </div>
              <PlainButton
                icon={p.blocked ? Undo2 : Ban}
                tone={p.blocked ? 'default' : 'danger'}
                loading={block.isPending && block.variables?.id === p.id}
                onClick={() => block.mutate({ id: p.id, on: !p.blocked })}
              >
                {p.blocked ? t('list.unblock') : t('list.block')}
              </PlainButton>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
