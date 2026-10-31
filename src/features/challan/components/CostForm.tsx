import { useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { MainButton, NumberField, Sheet, TextField } from '@/components/common'
import { useLang } from '@/lib/i18n'
import { toAppError } from '@/lib/errors'
import { cn } from '@/lib/cn'
import { COST_KINDS, type CostKind } from '../lib/risks'

/** "Add a cost" sheet — big kind buttons, amount in ₹, a short note. Used by the owner and the driver page. */
export function CostSheet({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onSave: (kind: CostKind, amountInr: number, note: string) => Promise<void>
}) {
  const { t } = useLang('challan')
  const [kind, setKind] = useState<CostKind>('challan')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [saving, setSaving] = useState(false)
  const value = Number(amount)

  const save = async () => {
    if (amount.trim() === '' || !Number.isFinite(value) || value <= 0 || value > 1_000_000) return setError(t('form.amountError'))
    setSaving(true)
    try {
      await onSave(kind, value, note)
      toast.success(t('form.saved'))
      setAmount('')
      setNote('')
      setError(undefined)
      onOpenChange(false)
    } catch (e) {
      toast.error(t(`common:errors.${toAppError(e).code}`))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('form.title')}
      dirty={amount !== '' || note !== ''}
      footer={
        <MainButton icon={Plus} size="lg" onClick={save} loading={saving} className="w-full">
          {t('form.save')}
        </MainButton>
      }
    >
      <div className="flex flex-col gap-4">
        <div role="radiogroup" aria-label={t('form.kind')} className="grid grid-cols-2 gap-2">
          {COST_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={cn(
                'min-h-14 rounded-tile border px-3 text-[17px] font-semibold',
                kind === k ? 'border-accent bg-accent-soft text-accent' : 'border-line-strong bg-surface-2',
              )}
            >
              {t(`common:costKinds.${k}`)}
            </button>
          ))}
        </div>
        <NumberField
          label={t('form.amount')}
          unit="₹"
          min={0}
          inputMode="numeric"
          value={amount}
          error={error}
          onChange={(e) => {
            setAmount(e.target.value)
            setError(undefined)
          }}
        />
        <TextField label={t('form.note')} help={t('form.noteHelp')} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Sheet>
  )
}
