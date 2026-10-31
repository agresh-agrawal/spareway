// /loads/new (F20): simple form → "Post for everyone" (public listing, code from next_listing_code()).
import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { ArrowLeft, Send } from 'lucide-react'
import { Card, MainButton, NumberField, PageHeader, PlainButton, SelectField, SwitchField, TextField } from '@/components/common'
import { useLang } from '@/lib/i18n'
import { toAppError } from '@/lib/errors'
import { places } from '@/features/trips'
import { usePostListing } from '../hooks'
import { postLoadSchema, type PostLoadInput, type PostLoadValues } from '../schemas'

const today = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10)

export default function PostLoadPage() {
  const { t, td } = useLang('extra-loads')
  const navigate = useNavigate()
  const post = usePostListing()
  const options = useMemo(
    () => [{ value: '', label: t('form.choose') }, ...places.map((p) => ({ value: p.id, label: td(p.name) }))],
    [t, td],
  )
  const form = useForm<PostLoadInput, unknown, PostLoadValues>({
    resolver: zodResolver(postLoadSchema),
    defaultValues: {
      shipper_name: '',
      shipper_phone: '',
      goods_type: '',
      from: '',
      to: '',
      length_cm: '',
      width_cm: '',
      height_cm: '',
      weight_kg: '',
      quantity: 1,
      fragile: false,
      offered_rate_inr: '',
      ready_from: today(),
    },
  })
  const err = (k: keyof PostLoadInput) => {
    const m = form.formState.errors[k]?.message
    return m ? t(String(m)) : undefined
  }
  const onSubmit = form.handleSubmit(async (v) => {
    const from = places.find((p) => p.id === v.from)!
    const to = places.find((p) => p.id === v.to)!
    try {
      const saved = await post.mutateAsync({
        shipper_name: v.shipper_name,
        shipper_phone: v.shipper_phone,
        goods_type: v.goods_type,
        pickup: { name: from.name, lat: from.lat, lng: from.lng },
        drop: { name: to.name, lat: to.lat, lng: to.lng },
        length_cm: v.length_cm,
        width_cm: v.width_cm,
        height_cm: v.height_cm,
        weight_kg: v.weight_kg,
        quantity: v.quantity,
        fragile: v.fragile,
        offered_rate_inr: v.offered_rate_inr,
        ready_from: new Date(`${v.ready_from}T00:00:00+05:30`).toISOString(),
      })
      toast.success(t('form.posted', { code: saved.code }))
      navigate('/loads')
    } catch (e) {
      toast.error(t(`common:errors.${toAppError(e).code}`))
    }
  })

  return (
    <form onSubmit={onSubmit} className="mx-auto flex w-full max-w-[720px] flex-col gap-4 pb-28" noValidate>
      <PlainButton type="button" icon={ArrowLeft} onClick={() => navigate('/loads')} className="self-start">
        {t('loads.title')}
      </PlainButton>
      <PageHeader title={t('form.title')} subtitle={t('form.subtitle')} className="mb-0" />
      <Card className="flex flex-col gap-4">
        <TextField label={t('form.who')} error={err('shipper_name')} {...form.register('shipper_name')} />
        <TextField label={t('form.phone')} type="tel" inputMode="tel" error={err('shipper_phone')} {...form.register('shipper_phone')} />
        <TextField label={t('form.what')} error={err('goods_type')} {...form.register('goods_type')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label={t('form.from')} options={options} error={err('from')} {...form.register('from')} />
          <SelectField label={t('form.to')} options={options} error={err('to')} {...form.register('to')} />
        </div>
      </Card>
      <Card className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-3">
          <NumberField label={t('form.lengthCm')} error={err('length_cm')} {...form.register('length_cm')} />
          <NumberField label={t('form.widthCm')} error={err('width_cm')} {...form.register('width_cm')} />
          <NumberField label={t('form.heightCm')} error={err('height_cm')} {...form.register('height_cm')} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField label={t('form.kgEach')} unit="kg" error={err('weight_kg')} {...form.register('weight_kg')} />
          <NumberField label={t('form.qty')} error={err('quantity')} {...form.register('quantity')} />
        </div>
        <Controller
          control={form.control}
          name="fragile"
          render={({ field }) => <SwitchField label={t('form.fragile')} help={t('form.fragileHelp')} checked={Boolean(field.value)} onCheckedChange={field.onChange} />}
        />
      </Card>
      <Card className="grid gap-4 sm:grid-cols-2">
        <NumberField label={t('form.offer')} unit="₹" error={err('offered_rate_inr')} {...form.register('offered_rate_inr')} />
        <TextField label={t('form.ready')} type="date" error={err('ready_from')} {...form.register('ready_from')} />
      </Card>
      <div className="safe-bottom fixed inset-x-0 bottom-16 z-20 border-t border-line bg-canvas/95 p-4 sm:static sm:border-0 sm:bg-transparent sm:p-0">
        <MainButton type="submit" icon={Send} loading={post.isPending} className="w-full sm:w-auto">
          {t('form.submit')}
        </MainButton>
      </div>
    </form>
  )
}
