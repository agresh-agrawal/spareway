// Owner addition: "Enter a load" — check a load offered on the phone with the same engine as the listings.
import { useMemo, useState } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ClipboardCheck, Plus, Trash2, X } from 'lucide-react'
import { MainButton, NumberField, PlainButton, SelectField, Sheet, SwitchField, TextField } from '@/components/common'
import { formatInr, formatWeight } from '@/lib/format'
import { useLang } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import { places } from '@/features/trips'
import type { Evaluation, LoadInput } from '../lib/evaluate'
import { typedLoadSchema, type TypedLoadInput, type TypedLoadValues } from '../schemas'
import { ChecksRow, DecisionChip, MoneyDetails, SafetyNote, evaluationReason } from './DecisionBlock'

export interface CheckedLoad {
  load: LoadInput
  ev: Evaluation
}

const emptyBatch = () => ({ label: '', quantity: 1, lengthCm: '', widthCm: '', heightCm: '', weightKg: '', fragile: false, nonStack: false, orientation: 'any' as const })

export function TypedLoadSheet({
  open,
  onOpenChange,
  evaluate,
  onChecked,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  evaluate: (load: LoadInput) => Promise<Evaluation>
  onChecked: (c: CheckedLoad) => void
}) {
  const { t, td } = useLang('extra-loads')
  const [busy, setBusy] = useState(false)
  const options = useMemo(() => [{ value: '', label: t('form.choose') }, ...places.map((p) => ({ value: p.id, label: td(p.name) }))], [t, td])
  const form = useForm<TypedLoadInput, unknown, TypedLoadValues>({
    resolver: zodResolver(typedLoadSchema),
    defaultValues: { batches: [emptyBatch()], from: '', to: '', offered_rate_inr: '', handling_inr: '', waiting_inr: '' },
  })
  const batches = useFieldArray({ control: form.control, name: 'batches' })
  const msg = (m?: unknown) => (m ? t(String(m)) : undefined)
  const errs = form.formState.errors

  const submit = form.handleSubmit(async (v) => {
    const from = places.find((p) => p.id === v.from)!
    const to = places.find((p) => p.id === v.to)!
    const load: LoadInput = {
      id: `typed-${crypto.randomUUID()}`,
      label: v.batches.map((b) => b.label).join(', '),
      batches: v.batches.map((b) => ({
        label: b.label,
        quantity: b.quantity,
        lengthCm: b.lengthCm,
        widthCm: b.widthCm,
        heightCm: b.heightCm,
        weightKg: b.weightKg,
        fragile: b.fragile,
        stackable: !(b.nonStack || b.fragile),
        uprightOnly: b.orientation === 'upright',
      })),
      pickup: { name: from.name, lat: from.lat, lng: from.lng },
      drop: { name: to.name, lat: to.lat, lng: to.lng },
      offerInr: v.offered_rate_inr,
      handlingInr: v.handling_inr ?? null,
      waitingInr: v.waiting_inr ?? null,
    }
    setBusy(true)
    try {
      onChecked({ load, ev: await evaluate(load) })
      form.reset({ batches: [emptyBatch()], from: '', to: '', offered_rate_inr: '', handling_inr: '', waiting_inr: '' })
      onOpenChange(false)
    } finally {
      setBusy(false)
    }
  })

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('typed.sheetTitle')}
      description={t('typed.help')}
      dirty={form.formState.isDirty}
      footer={
        <MainButton type="submit" form="typed-load" icon={ClipboardCheck} loading={busy} className="w-full">
          {t('typed.check')}
        </MainButton>
      }
    >
      <form id="typed-load" onSubmit={submit} noValidate className="flex flex-col gap-4">
        {batches.fields.map((f, i) => {
          const be = errs.batches?.[i]
          return (
            <fieldset key={f.id} className="flex flex-col gap-3 rounded-tile border border-line bg-surface-2 p-3">
              <legend className="px-1 text-label font-semibold text-ink-2">{t('typed.batch', { n: i + 1 })}</legend>
              <TextField label={t('typed.name')} error={msg(be?.label?.message)} {...form.register(`batches.${i}.label`)} />
              <div className="grid grid-cols-2 gap-3">
                <NumberField label={t('form.qty')} error={msg(be?.quantity?.message)} {...form.register(`batches.${i}.quantity`)} />
                <NumberField label={t('form.kgEach')} unit="kg" error={msg(be?.weightKg?.message)} {...form.register(`batches.${i}.weightKg`)} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <NumberField label={t('form.lengthCm')} error={msg(be?.lengthCm?.message)} {...form.register(`batches.${i}.lengthCm`)} />
                <NumberField label={t('form.widthCm')} error={msg(be?.widthCm?.message)} {...form.register(`batches.${i}.widthCm`)} />
                <NumberField label={t('form.heightCm')} error={msg(be?.heightCm?.message)} {...form.register(`batches.${i}.heightCm`)} />
              </div>
              <SelectField
                label={t('typed.orientation')}
                options={[
                  { value: 'any', label: t('typed.anyWay') },
                  { value: 'upright', label: t('typed.upright') },
                ]}
                {...form.register(`batches.${i}.orientation`)}
              />
              <Controller
                control={form.control}
                name={`batches.${i}.fragile`}
                render={({ field }) => <SwitchField label={t('form.fragile')} help={t('form.fragileHelp')} checked={Boolean(field.value)} onCheckedChange={field.onChange} />}
              />
              <Controller
                control={form.control}
                name={`batches.${i}.nonStack`}
                render={({ field }) => <SwitchField label={t('typed.nonStack')} help={t('typed.nonStackHelp')} checked={Boolean(field.value)} onCheckedChange={field.onChange} />}
              />
              {batches.fields.length > 1 && (
                <PlainButton type="button" icon={Trash2} tone="danger" onClick={() => batches.remove(i)} className="self-start">
                  {t('typed.removeBatch')}
                </PlainButton>
              )}
            </fieldset>
          )
        })}
        {batches.fields.length < 10 && (
          <PlainButton type="button" icon={Plus} onClick={() => batches.append(emptyBatch())} className="self-start">
            {t('typed.addBatch')}
          </PlainButton>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField label={t('form.from')} options={options} error={msg(errs.from?.message)} {...form.register('from')} />
          <SelectField label={t('form.to')} options={options} error={msg(errs.to?.message)} {...form.register('to')} />
        </div>
        <NumberField label={t('form.offer')} unit="₹" error={msg(errs.offered_rate_inr?.message)} {...form.register('offered_rate_inr')} />
        <div className="grid grid-cols-2 gap-3">
          <NumberField label={t('typed.handlingOpt')} help={t('typed.optHelp')} error={msg(errs.handling_inr?.message)} {...form.register('handling_inr')} />
          <NumberField label={t('typed.waitingOpt')} help={t('typed.optHelp')} error={msg(errs.waiting_inr?.message)} {...form.register('waiting_inr')} />
        </div>
      </form>
    </Sheet>
  )
}

/** Result of a typed load: decision first, checks, earnings, money details (open), safety note. */
export function TypedResultCard({ c, onRemove }: { c: CheckedLoad; onRemove: () => void }) {
  const { t, td } = useLang('extra-loads')
  const { load, ev } = c
  const reason = evaluationReason(ev, t)
  return (
    <article aria-label={load.label} className={cn('flex min-w-0 flex-col gap-3 rounded-card border bg-surface p-4 sm:p-5', ev.decision === 'ACCEPT' ? 'border-ok/40' : 'border-line')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-2">
          <DecisionChip decision={ev.decision} />
          <h3 className="text-section-title font-semibold">{load.label}</h3>
        </span>
        <PlainButton icon={X} onClick={onRemove}>
          {t('typed.clear')}
        </PlainButton>
      </div>
      <div className="text-ink-2">
        {t('card.fromTo', { from: td(load.pickup.name), to: td(load.drop.name) })} · {ev.units} · {formatWeight(ev.kg)}
      </div>
      <ChecksRow ev={ev} />
      {reason && <p className={ev.decision === 'NEEDS_REVIEW' ? 'text-info' : 'text-warn'}>{reason}</p>}
      <div>
        <div className="text-label text-ink-2">{t('money.earnings')}</div>
        <div className={cn('text-[28px] leading-9 font-semibold tabular', ev.earningsInr >= 0 ? 'text-ok' : 'text-crit')}>
          {ev.earningsInr >= 0 ? '+' : ''}
          {formatInr(ev.earningsInr)}
        </div>
      </div>
      <MoneyDetails ev={ev} offerInr={load.offerInr} open />
      <SafetyNote />
    </article>
  )
}
