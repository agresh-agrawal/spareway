import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Send, Trash2 } from 'lucide-react'
import { Card, MainButton, PlainButton } from '@/components/common'
import { useLang } from '@/lib/i18n'
import { toAppError } from '@/lib/errors'
import type { ProviderLoad } from '../api'
import { toProviderLoad } from '../lib/convert'
import { emptyLoad, formErrors, loadFormSchema, type LoadForm } from '../lib/offer'
import { LoadFields } from './LoadFields'

/** One or more loads (a batch), checked, then sent together. The next load starts with the same route and dates. */
export function UploadLoads({ goodsHint, onSend }: { goodsHint?: string; onSend: (loads: ProviderLoad[]) => Promise<void> }) {
  const { t } = useLang('provider')
  const [loads, setLoads] = useState<LoadForm[]>([emptyLoad()])
  const [errs, setErrs] = useState<Record<string, string>[]>([{}])
  const [sending, setSending] = useState(false)

  const send = async () => {
    const checks = loads.map((l) => loadFormSchema.safeParse(l))
    setErrs(checks.map(formErrors))
    if (checks.some((c) => !c.success)) {
      toast.error(t('fixErrors'))
      return
    }
    setSending(true)
    try {
      await onSend(checks.map((c) => toProviderLoad(c.data!)))
      setLoads([emptyLoad()])
      setErrs([{}])
    } catch (e) {
      toast.error(t(`common:errors.${toAppError(e).code}`))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
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
          <LoadFields value={l} errors={errs[i] ?? {}} goodsHint={goodsHint} onChange={(v) => setLoads(loads.map((x, j) => (j === i ? v : x)))} />
        </Card>
      ))}
      {loads.length < 10 && (
        <PlainButton
          icon={Plus}
          onClick={() => {
            const last = loads.at(-1)!
            setLoads([...loads, { ...emptyLoad(), from: last.from, to: last.to, readyFrom: last.readyFrom, deliverBy: last.deliverBy }])
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
    </div>
  )
}
