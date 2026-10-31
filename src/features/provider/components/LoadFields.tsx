import { useMemo } from 'react'
import { NumberField, SelectField, SwitchField, TextField } from '@/components/common'
import { places } from '@/features/trips'
import { useLang } from '@/lib/i18n'
import type { LoadForm } from '../lib/offer'

/** One load: what, from → to, size of one piece, weight, how many, fragile, price, dates, note. */
export function LoadFields({
  value,
  onChange,
  errors,
}: {
  value: LoadForm
  onChange: (v: LoadForm) => void
  errors: Record<string, string>
}) {
  const { t, td } = useLang('provider')
  const options = useMemo(
    () => [
      { value: '', label: t('form.choose') },
      ...places.map((p) => ({ value: p.id, label: td(p.name) })),
    ],
    [t, td],
  )
  const set = <K extends keyof LoadForm>(k: K, v: LoadForm[K]) => onChange({ ...value, [k]: v })
  const err = (k: string) => (errors[k] ? t(errors[k]) : undefined)
  const str = (v: unknown) => (v === undefined || v === null ? '' : String(v))
  return (
    <div className="flex flex-col gap-4">
      <TextField
        label={t('form.goods')}
        placeholder={t('form.goodsHint')}
        value={value.goods}
        error={err('goods')}
        onChange={(e) => set('goods', e.target.value)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label={t('form.from')}
          options={options}
          value={value.from}
          error={err('from')}
          onChange={(e) => set('from', e.target.value)}
        />
        <SelectField
          label={t('form.to')}
          options={options}
          value={value.to}
          error={err('to')}
          onChange={(e) => set('to', e.target.value)}
        />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-label font-medium text-ink-2">{t('form.onePiece')}</legend>
        <div className="grid grid-cols-3 gap-2">
          <NumberField
            label={t('form.length')}
            unit="cm"
            inputMode="decimal"
            value={str(value.lengthCm)}
            error={err('lengthCm')}
            onChange={(e) => set('lengthCm', e.target.value)}
          />
          <NumberField
            label={t('form.width')}
            unit="cm"
            inputMode="decimal"
            value={str(value.widthCm)}
            error={err('widthCm')}
            onChange={(e) => set('widthCm', e.target.value)}
          />
          <NumberField
            label={t('form.height')}
            unit="cm"
            inputMode="decimal"
            value={str(value.heightCm)}
            error={err('heightCm')}
            onChange={(e) => set('heightCm', e.target.value)}
          />
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label={t('form.kgEach')}
          unit="kg"
          inputMode="decimal"
          value={str(value.weightKg)}
          error={err('weightKg')}
          onChange={(e) => set('weightKg', e.target.value)}
        />
        <NumberField
          label={t('form.qty')}
          inputMode="numeric"
          value={str(value.quantity)}
          error={err('quantity')}
          onChange={(e) => set('quantity', e.target.value)}
        />
      </div>
      <SwitchField
        label={t('form.fragile')}
        checked={value.fragile}
        onCheckedChange={(c) => set('fragile', c)}
      />
      <NumberField
        label={t('form.price')}
        help={t('form.priceHelp')}
        unit="₹"
        inputMode="numeric"
        value={str(value.priceInr)}
        error={err('priceInr')}
        onChange={(e) => set('priceInr', e.target.value)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t('form.ready')}
          type="date"
          value={value.readyFrom}
          onChange={(e) => set('readyFrom', e.target.value)}
        />
        <TextField
          label={t('form.deliverBy')}
          type="date"
          value={value.deliverBy}
          error={err('deliverBy')}
          onChange={(e) => set('deliverBy', e.target.value)}
        />
      </div>
      <TextField
        label={t('form.note')}
        maxLength={200}
        value={value.note}
        onChange={(e) => set('note', e.target.value)}
      />
    </div>
  )
}
