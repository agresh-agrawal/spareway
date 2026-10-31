import { useEffect, useState } from 'react'
import { Controller, useForm, type Control } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Save } from 'lucide-react'
import { toast } from 'sonner'
import { MainButton, NumberField, SelectField, Sheet, SwitchField, TextField } from '@/components/common'
import { useLang } from '@/lib/i18n'
import { toAppError } from '@/lib/errors'
import { cmToIn, inToCm } from '@/lib/units'
import { cn } from '@/lib/cn'
import type { TripStop } from '@/features/trips'
import type { CargoItem } from '../api'
import { useSaveCargo } from '../hooks'
import { cargoSchema, type CargoInput, type CargoValues } from '../schemas'

type Unit = 'cm' | 'in'
const show = (cm: number, u: Unit) => (Number.isFinite(cm) ? String(u === 'in' ? Math.round(cmToIn(cm) * 10) / 10 : Math.round(cm * 10) / 10) : '')
const parse = (text: string, u: Unit) => {
  const n = Number(text.replace(',', '.'))
  if (text.trim() === '' || !Number.isFinite(n)) return Number.NaN
  return u === 'in' ? inToCm(n) : Math.round(n * 10) / 10
}

function SizeInput({ control, name, label, unit, error }: { control: Control<CargoInput>; name: 'length_cm' | 'width_cm' | 'height_cm'; label: string; unit: Unit; error?: string }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => <Inner label={label} unit={unit} cm={field.value as number} onCm={field.onChange} error={error} />}
    />
  )
}

function Inner({ label, unit, cm, onCm, error }: { label: string; unit: Unit; cm: number; onCm: (v: number) => void; error?: string }) {
  const [text, setText] = useState(() => show(cm, unit))
  useEffect(() => {
    if (parse(text, unit) !== cm) setText(show(cm, unit))
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
        onCm(parse(e.target.value, unit))
      }}
    />
  )
}

function blank(stops: TripStop[]): CargoInput {
  const firstDrop = stops.find((s) => s.stop_type !== 'origin')
  return {
    label: '',
    client_name: '',
    length_cm: Number.NaN,
    width_cm: Number.NaN,
    height_cm: Number.NaN,
    weight_kg: Number.NaN,
    quantity: 1,
    drop_stop_id: firstDrop?.id ?? '',
    pickup_stop_id: null,
    fragile: false,
    upright_only: false,
    stackable: true,
    priority: 'normal',
  }
}

export function fromItem(c: CargoItem): CargoInput {
  return {
    label: c.label,
    client_name: c.client_name,
    length_cm: Number(c.length_cm),
    width_cm: Number(c.width_cm),
    height_cm: Number(c.height_cm),
    weight_kg: Number(c.weight_kg),
    quantity: c.quantity,
    drop_stop_id: c.drop_stop_id,
    pickup_stop_id: c.pickup_stop_id,
    fragile: c.fragile,
    upright_only: c.upright_only,
    stackable: c.stackable,
    priority: c.priority as CargoInput['priority'],
  }
}

export function CargoItemSheet({
  open,
  onOpenChange,
  tripId,
  stops,
  item,
  initial,
  defaultUnit = 'cm',
  onSaved,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  tripId: string
  stops: TripStop[]
  /** editing this item */
  item?: CargoItem
  /** prefill for a new item (copy) */
  initial?: CargoInput
  defaultUnit?: Unit
  onSaved?: () => void
}) {
  const { t, td } = useLang('cargo')
  const save = useSaveCargo(tripId)
  const [unit, setUnit] = useState<Unit>(defaultUnit)
  const form = useForm<CargoInput, unknown, CargoValues>({ resolver: zodResolver(cargoSchema), defaultValues: blank(stops) })
  const { errors, isDirty } = form.formState
  const err = (k?: string) => (k ? t(k) : undefined)

  useEffect(() => {
    if (open) form.reset(item ? fromItem(item) : (initial ?? blank(stops)))
  }, [open, item, initial]) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({ values, id: item?.id })
      toast.success(t('form.saved'))
      onOpenChange(false)
      onSaved?.()
    } catch (e) {
      toast.error(t(`common:errors.${toAppError(e).code}`))
    }
  })

  const drops = stops.filter((s) => s.stop_type !== 'origin')
  const pickups = stops.filter((s) => s.stop_type === 'pickup')
  const numReg = (name: 'weight_kg' | 'quantity') => form.register(name, { valueAsNumber: true })

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      dirty={isDirty}
      title={item ? t('form.editTitle') : t('form.addTitle')}
      footer={
        <MainButton icon={Save} onClick={submit} loading={save.isPending} className="w-full">
          {t('form.save')}
        </MainButton>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <TextField label={t('form.label')} help={t('form.labelHelp')} error={err(errors.label?.message)} {...form.register('label')} />
        <TextField label={t('form.client')} error={err(errors.client_name?.message)} {...form.register('client_name')} />

        <fieldset className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <legend className="text-label font-medium text-ink-2">{t('form.size')}</legend>
            <div className="flex rounded-control border border-line-strong bg-surface-2 p-1" role="group" aria-label={t('form.size')}>
              {(['cm', 'in'] as const).map((u) => (
                <button key={u} type="button" aria-pressed={unit === u} onClick={() => setUnit(u)} className={cn('h-10 min-w-12 rounded-[10px] px-2 text-[15px] font-semibold', unit === u ? 'bg-accent text-accent-ink' : 'text-ink-2')}>
                  {u}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <SizeInput control={form.control} name="length_cm" label={`${t('form.length')} (${unit})`} unit={unit} error={err(errors.length_cm?.message)} />
            <SizeInput control={form.control} name="width_cm" label={`${t('form.width')} (${unit})`} unit={unit} error={err(errors.width_cm?.message)} />
            <SizeInput control={form.control} name="height_cm" label={`${t('form.height')} (${unit})`} unit={unit} error={err(errors.height_cm?.message)} />
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <NumberField label={t('form.weight')} unit="kg" error={err(errors.weight_kg?.message)} {...numReg('weight_kg')} />
          <NumberField label={t('form.quantity')} min={1} error={err(errors.quantity?.message)} {...numReg('quantity')} />
        </div>

        <SelectField
          label={t('form.drop')}
          error={err(errors.drop_stop_id?.message)}
          options={drops.map((s) => ({ value: s.id, label: `${s.seq} · ${td(s.name)}` }))}
          {...form.register('drop_stop_id')}
        />
        {pickups.length > 0 && (
          <Controller
            control={form.control}
            name="pickup_stop_id"
            render={({ field }) => (
              <SelectField
                label={t('form.pickup')}
                options={[{ value: '', label: t('form.pickupOrigin') }, ...pickups.map((s) => ({ value: s.id, label: `${s.seq} · ${td(s.name)}` }))]}
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value || null)}
              />
            )}
          />
        )}

        <div className="flex flex-col divide-y divide-line rounded-tile border border-line bg-surface-2 px-4">
          <Controller control={form.control} name="fragile" render={({ field }) => <SwitchField label={t('form.fragile')} help={t('form.fragileHelp')} checked={field.value} onCheckedChange={field.onChange} />} />
          <Controller control={form.control} name="upright_only" render={({ field }) => <SwitchField label={t('form.upright')} help={t('form.uprightHelp')} checked={field.value} onCheckedChange={field.onChange} />} />
          <Controller
            control={form.control}
            name="stackable"
            render={({ field }) => <SwitchField label={t('form.noStack')} help={t('form.noStackHelp')} checked={!field.value} onCheckedChange={(v) => field.onChange(!v)} />}
          />
        </div>

        <SelectField
          label={t('form.priority')}
          options={(['low', 'normal', 'high', 'critical'] as const).map((p) => ({ value: p, label: t(`form.priorities.${p}`) }))}
          {...form.register('priority')}
        />
      </form>
    </Sheet>
  )
}
