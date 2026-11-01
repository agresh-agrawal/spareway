import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { toast } from 'sonner'
import { MainButton, NumberField, Sheet } from '@/components/common'
import { useLang } from '@/lib/i18n'
import { toAppError } from '@/lib/errors'
import { formatWeight } from '@/lib/format'
import { addDriverWeighing } from '../api'

/** One GPS fix, or null (denied / no GPS / 8 s) — saved with the reading so the owner sees where it was weighed. */
function onePosition(): Promise<{ lat: number; lng: number; accuracyM: number | null } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null)
  return new Promise((res) =>
    navigator.geolocation.getCurrentPosition(
      (p) => res({ lat: p.coords.latitude, lng: p.coords.longitude, accuracyM: p.coords.accuracy ?? null }),
      () => res(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    ),
  )
}

/** Driver types the weighbridge reading; the database compares it with the declared cargo and tells the owner. */
export function WeighSheet({
  token,
  open,
  onOpenChange,
  onSaved,
}: {
  token: string
  open: boolean
  onOpenChange: (o: boolean) => void
  onSaved: () => void
}) {
  const { t } = useLang('driver')
  const [gross, setGross] = useState('')
  const [tare, setTare] = useState('')
  const [tried, setTried] = useState(false)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (open) {
      setGross('')
      setTare('')
      setTried(false)
    }
  }, [open])

  const g = Number(gross.replace(',', '.'))
  const tr = tare.trim() === '' ? null : Number(tare.replace(',', '.'))
  const grossOk = g > 0 && g <= 100000
  const tareOk = tr === null || (tr > 0 && tr < g)
  const save = async () => {
    setTried(true)
    if (!grossOk || !tareOk) return
    setSaving(true)
    try {
      const r = await addDriverWeighing(token, g, tr, await onePosition())
      if (r.match) toast.success(t('weigh.match', { net: formatWeight(r.net) }))
      else toast.warning(t('weigh.mismatch', { net: formatWeight(r.net), declared: formatWeight(r.declared) }))
      onSaved()
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
      dirty={gross !== '' || tare !== ''}
      title={t('weigh.title')}
      description={t('weigh.text')}
      footer={
        <MainButton icon={Save} size="lg" onClick={save} loading={saving} className="w-full">
          {t('weigh.save')}
        </MainButton>
      }
    >
      <div className="flex flex-col gap-4">
        <NumberField
          label={t('weigh.gross')}
          unit="kg"
          inputMode="decimal"
          value={gross}
          error={tried && !grossOk ? t('weigh.grossError') : undefined}
          onChange={(e) => setGross(e.target.value)}
        />
        <NumberField
          label={t('weigh.tare')}
          unit="kg"
          inputMode="decimal"
          value={tare}
          help={t('weigh.tareHelp')}
          error={tried && grossOk && !tareOk ? t('weigh.tareError') : undefined}
          onChange={(e) => setTare(e.target.value)}
        />
      </div>
    </Sheet>
  )
}
