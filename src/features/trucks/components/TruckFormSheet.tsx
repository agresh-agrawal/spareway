import { useEffect, useState } from 'react'
import { Controller, useForm, useWatch, type Control } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronDown, ChevronUp, Save } from 'lucide-react'
import { toast } from 'sonner'
import { MainButton, NumberField, SelectField, Sheet, TextField } from '@/components/common'
import { useLang } from '@/lib/i18n'
import { toAppError } from '@/lib/errors'
import { formatTruckSize } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Truck } from '../api'
import { useSaveTruck } from '../hooks'
import { TRUCK_PRESETS } from '../lib/presets'
import { cmToDisplay, displayToCm, type SizeUnit } from '../lib/sizes'
import { TRUCK_STATUSES, truckSchema, type TruckInput, type TruckValues } from '../schemas'
import { BoxPreview } from './BoxPreview'

const EMPTY: TruckInput = {
  reg_no: '',
  model: '',
  body_type: 'closed',
  internal_length_cm: Number.NaN,
  internal_width_cm: Number.NaN,
  internal_height_cm: Number.NaN,
  payload_kg: Number.NaN,
  axles: 2,
  mileage_kmpl: 4,
  cost_per_km_inr: 30,
  driver_name: '',
  driver_phone: '',
  status: 'idle',
}

function fromTruck(t: Truck): TruckInput {
  return {
    reg_no: t.reg_no,
    model: t.model,
    body_type: t.body_type as TruckInput['body_type'],
    internal_length_cm: Number(t.internal_length_cm),
    internal_width_cm: Number(t.internal_width_cm),
    internal_height_cm: Number(t.internal_height_cm),
    payload_kg: Number(t.payload_kg),
    axles: t.axles,
    mileage_kmpl: Number(t.mileage_kmpl),
    cost_per_km_inr: Number(t.cost_per_km_inr),
    driver_name: t.driver_name,
    driver_phone: t.driver_phone,
    status: t.status as TruckInput['status'],
  }
}

/**
 * A size kept in cm. The text shown follows the unit; the cm value only changes when the owner types,
 * so an untouched 243 cm stays 243 even though it shows as 7.97 ft.
 */
function SizeField({
  control,
  name,
  label,
  unit,
  error,
}: {
  control: Control<TruckInput>
  name: 'internal_length_cm' | 'internal_width_cm' | 'internal_height_cm'
  label: string
  unit: SizeUnit
  error?: string
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => <SizeInput label={label} unit={unit} cm={field.value as number} onCm={field.onChange} error={error} />}
    />
  )
}

function SizeInput({ label, unit, cm, onCm, error }: { label: string; unit: SizeUnit; cm: number; onCm: (v: number) => void; error?: string }) {
  const [text, setText] = useState(() => cmToDisplay(cm, unit))
  // re-derive the text when the unit or the value changes from outside (preset)
  useEffect(() => {
    if (displayToCm(text, unit) !== cm) setText(cmToDisplay(cm, unit))
  }, [cm, unit]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <TextField
      label={label}
      inputMode="decimal"
      value={text}
      error={error}
      className="tabular"
      onChange={(e) => {
        setText(e.target.value)
        onCm(displayToCm(e.target.value, unit))
      }}
    />
  )
}

export function TruckFormSheet({
  open,
  onOpenChange,
  truck,
  onSaved,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  truck?: Truck
  onSaved?: (t: Truck) => void
}) {
  const { t } = useLang('trucks')
  const save = useSaveTruck()
  const [unit, setUnit] = useState<SizeUnit>('ft')
  const [more, setMore] = useState(false)
  const [preset, setPreset] = useState('')
  const form = useForm<TruckInput, unknown, TruckValues>({
    resolver: zodResolver(truckSchema),
    defaultValues: truck ? fromTruck(truck) : EMPTY,
  })
  const { errors, isDirty } = form.formState
  const err = (k?: string) => (k ? t(k) : undefined)
  const [l, w, h] = useWatch({ control: form.control, name: ['internal_length_cm', 'internal_width_cm', 'internal_height_cm'] })

  useEffect(() => {
    if (open) {
      form.reset(truck ? fromTruck(truck) : EMPTY)
      setPreset('')
      setMore(false)
    }
  }, [open, truck]) // eslint-disable-line react-hooks/exhaustive-deps

  const applyPreset = (id: string) => {
    setPreset(id)
    const p = TRUCK_PRESETS.find((x) => x.id === id)
    if (!p) return
    const opts = { shouldDirty: true, shouldValidate: true }
    form.setValue('internal_length_cm', p.lengthCm, opts)
    form.setValue('internal_width_cm', p.widthCm, opts)
    form.setValue('internal_height_cm', p.heightCm, opts)
    form.setValue('payload_kg', p.payloadKg, opts)
    form.setValue('axles', p.axles, opts)
    form.setValue('body_type', p.bodyType, opts)
  }

  const submit = form.handleSubmit(async (values) => {
    try {
      const saved = await save.mutateAsync({ values, id: truck?.id })
      toast.success(t('form.saved'))
      onOpenChange(false)
      onSaved?.(saved)
    } catch (e) {
      const code = toAppError(e).code
      if (code === 'DUPLICATE') form.setError('reg_no', { message: 'trucks:errors.duplicate' })
      else toast.error(t(`common:errors.${code}`))
    }
  })

  const statusOptions = TRUCK_STATUSES.map((s) => ({ value: s, label: t(`common:truckStatus.${s}`) }))
  const presetOptions = [{ value: '', label: t('form.presetNone') }, ...TRUCK_PRESETS.map((p) => ({ value: p.id, label: p.label }))]
  const num = (name: 'axles' | 'mileage_kmpl' | 'cost_per_km_inr') => form.register(name, { valueAsNumber: true })

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      dirty={isDirty}
      title={truck ? t('form.editTitle', { reg: truck.reg_no }) : t('form.addTitle')}
      footer={
        <MainButton icon={Save} onClick={submit} loading={save.isPending} className="w-full">
          {t('form.save')}
        </MainButton>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <TextField label={t('form.regNo')} help={t('form.regNoHelp')} autoCapitalize="characters" error={err(errors.reg_no?.message)} {...form.register('reg_no')} />
        <TextField label={t('form.model')} help={t('form.modelHelp')} error={err(errors.model?.message)} {...form.register('model')} />
        <SelectField label={t('form.preset')} help={t('form.presetHelp')} options={presetOptions} value={preset} onChange={(e) => applyPreset(e.target.value)} />

        <fieldset className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <legend className="text-label font-medium text-ink-2">{t('form.inside')}</legend>
            <div className="flex rounded-control border border-line-strong bg-surface-2 p-1" role="group" aria-label={t('form.inside')}>
              {(['ft', 'cm'] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  aria-pressed={unit === u}
                  onClick={() => setUnit(u)}
                  className={cn('h-10 min-w-12 rounded-[10px] px-2 text-[15px] font-semibold', unit === u ? 'bg-accent text-accent-ink' : 'text-ink-2')}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <SizeField control={form.control} name="internal_length_cm" label={`${t('form.length')} (${unit})`} unit={unit} error={err(errors.internal_length_cm?.message)} />
            <SizeField control={form.control} name="internal_width_cm" label={`${t('form.width')} (${unit})`} unit={unit} error={err(errors.internal_width_cm?.message)} />
            <SizeField control={form.control} name="internal_height_cm" label={`${t('form.height')} (${unit})`} unit={unit} error={err(errors.internal_height_cm?.message)} />
          </div>
          <div className="rounded-tile border border-line bg-surface-2 p-3">
            <BoxPreview lengthCm={l as number} widthCm={w as number} heightCm={h as number} />
            {[l, w, h].every((v) => Number.isFinite(v as number)) && (
              <p className="text-center text-label text-ink-2 tabular">
                {t('form.preview', { size: formatTruckSize(l as number, w as number, h as number) })}
              </p>
            )}
          </div>
        </fieldset>

        <Controller
          control={form.control}
          name="payload_kg"
          render={({ field }) => (
            <NumberField
              label={t('form.payload')}
              help={t('form.payloadHelp')}
              unit="t"
              error={err(errors.payload_kg?.message)}
              value={Number.isFinite(field.value as number) ? Math.round((field.value as number) / 100) / 10 : ''}
              onChange={(e) => field.onChange(e.target.value === '' ? Number.NaN : Math.round(Number(e.target.value) * 1000))}
            />
          )}
        />
        <NumberField label={t('form.costPerKm')} help={t('form.costPerKmHelp')} unit="₹" error={err(errors.cost_per_km_inr?.message)} {...num('cost_per_km_inr')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t('form.driverName')} autoComplete="off" error={err(errors.driver_name?.message)} {...form.register('driver_name')} />
          <TextField label={t('form.driverPhone')} type="tel" inputMode="tel" error={err(errors.driver_phone?.message)} {...form.register('driver_phone')} />
        </div>
        <SelectField label={t('form.status')} options={statusOptions} {...form.register('status')} />

        <button
          type="button"
          onClick={() => setMore((m) => !m)}
          aria-expanded={more}
          className="flex min-h-12 items-center justify-between rounded-tile border border-line bg-surface-2 px-4 font-semibold hover:bg-surface-3"
        >
          {t('form.moreDetails')}
          {more ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
        {more && (
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField label={t('form.axles')} min={2} max={8} error={err(errors.axles?.message)} {...num('axles')} />
            <NumberField label={t('form.mileage')} error={err(errors.mileage_kmpl?.message)} {...num('mileage_kmpl')} />
            <div className="sm:col-span-2">
              <SelectField
                label={t('form.bodyType')}
                options={(['closed', 'container', 'open'] as const).map((b) => ({ value: b, label: t(`form.body.${b}`) }))}
                {...form.register('body_type')}
              />
            </div>
          </div>
        )}
      </form>
    </Sheet>
  )
}
