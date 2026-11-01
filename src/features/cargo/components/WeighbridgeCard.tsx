import { useEffect, useRef, useState } from 'react'
import { Camera, CheckCircle2, MapPin, Save, Scale, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import {
  Card,
  CardHeader,
  MainButton,
  NumberField,
  PlainButton,
  Sheet,
  StatusChip,
} from '@/components/common'
import { useLang } from '@/lib/i18n'
import { toAppError } from '@/lib/errors'
import { formatDayTime, formatWeight } from '@/lib/format'
import type { Weighing } from '../api'
import { useAddWeighing, useWeighings } from '../hooks'
import { cargoErrorKey } from './IntegrityNotes'

type Pos = { lat: number; lng: number; accuracyM: number | null }

/** One GPS fix, or null (denied / no GPS / 8 s). */
export function currentPosition(): Promise<Pos | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null)
  return new Promise((res) =>
    navigator.geolocation.getCurrentPosition(
      (p) => res({ lat: p.coords.latitude, lng: p.coords.longitude, accuracyM: p.coords.accuracy ?? null }),
      () => res(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    ),
  )
}

/** The latest slip: weighed vs declared, match, and whether it was weighed near the loading point. */
export function WeighingResult({ w }: { w: Weighing }) {
  const { t, lang } = useLang('cargo')
  const match = w.status === 'match'
  return (
    <div className="flex flex-col gap-1.5">
      <p className="font-semibold tabular">
        {t('integrity.weigh.result', {
          net: formatWeight(Number(w.net_kg)),
          declared: formatWeight(Number(w.declared_kg)),
        })}
      </p>
      <StatusChip tone={match ? 'ok' : 'crit'}>
        {match
          ? t('integrity.weigh.match')
          : t('integrity.weigh.mismatch', { diff: formatWeight(Math.abs(Number(w.diff_kg))) })}
      </StatusChip>
      <p className="flex items-center gap-1.5 text-label text-ink-2">
        <MapPin size={16} aria-hidden />
        {w.distance_km == null
          ? t('integrity.weigh.placeUnknown')
          : w.place_ok
            ? t('integrity.weigh.placeOk')
            : t('integrity.weigh.placeFar', { km: Math.round(Number(w.distance_km)) })}
      </p>
      <p className="text-label text-ink-3 tabular">
        {w.entered_by === 'driver' ? `${t('integrity.weigh.byDriver')} · ` : ''}
        {formatDayTime(w.created_at, lang)}
      </p>
    </div>
  )
}

function WeighSheet({
  tripId,
  open,
  onOpenChange,
  defaultTare,
}: {
  tripId: string
  open: boolean
  onOpenChange: (o: boolean) => void
  defaultTare: number | null
}) {
  const { t } = useLang('cargo')
  const add = useAddWeighing(tripId)
  const input = useRef<HTMLInputElement>(null)
  const [gross, setGross] = useState('')
  const [tare, setTare] = useState('')
  const [slip, setSlip] = useState<File | null>(null)
  const [tried, setTried] = useState(false)
  useEffect(() => {
    if (open) {
      setGross('')
      setTare('')
      setSlip(null)
      setTried(false)
    }
  }, [open])

  const g = Number(gross.replace(',', '.'))
  const tr = tare.trim() === '' ? null : Number(tare.replace(',', '.'))
  const tareUsed = tr ?? defaultTare
  const grossErr = tried && !(g > 0 && g <= 100000) ? t('integrity.weigh.gross') : undefined
  const tareErr = tried && g > 0 && (!tareUsed || g <= tareUsed) ? t('integrity.errors.tare') : undefined
  const slipErr = tried && !slip ? t('integrity.errors.slip') : undefined

  const save = async () => {
    setTried(true)
    if (!(g > 0 && g <= 100000) || !tareUsed || g <= tareUsed || !slip) return
    try {
      const pos = await currentPosition()
      await add.mutateAsync({
        grossKg: g,
        tareKg: tr,
        slip,
        lat: pos?.lat ?? null,
        lng: pos?.lng ?? null,
        accuracyM: pos?.accuracyM ?? null,
      })
      toast.success(t('integrity.weigh.saved'))
      onOpenChange(false)
    } catch (e) {
      toast.error(t(cargoErrorKey(toAppError(e))))
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      dirty={gross !== '' || slip !== null}
      title={t('integrity.weigh.add')}
      description={t('integrity.weigh.useGps')}
      footer={
        <MainButton icon={Save} onClick={save} loading={add.isPending} className="w-full">
          {t('integrity.weigh.save')}
        </MainButton>
      }
    >
      <div className="flex flex-col gap-4">
        <NumberField
          label={t('integrity.weigh.gross')}
          unit="kg"
          inputMode="decimal"
          value={gross}
          error={grossErr}
          onChange={(e) => setGross(e.target.value)}
        />
        <NumberField
          label={t('integrity.weigh.tare')}
          unit="kg"
          inputMode="decimal"
          value={tare}
          error={tareErr}
          help={defaultTare ? t('integrity.weigh.tareHelp', { kg: formatWeight(defaultTare) }) : undefined}
          onChange={(e) => setTare(e.target.value)}
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-label font-medium text-ink-2">{t('integrity.weigh.slip')}</span>
          <input
            ref={input}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              setSlip(e.target.files?.[0] ?? null)
              e.target.value = ''
            }}
          />
          <PlainButton icon={slip ? CheckCircle2 : Camera} onClick={() => input.current?.click()}>
            {slip ? t('integrity.weigh.slipReady') : t('integrity.weigh.slipTake')}
          </PlainButton>
          {slipErr && <span className="text-label text-crit">{slipErr}</span>}
        </div>
      </div>
    </Sheet>
  )
}

/** Weighbridge proof on the Cargo step: the only measured weight; typed / AI weights stay "declared". */
export function WeighbridgeCard({
  tripId,
  defaultTare,
  canAdd,
}: {
  tripId: string
  defaultTare: number | null
  canAdd: boolean
}) {
  const { t } = useLang('cargo')
  const weighings = useWeighings(tripId)
  const [open, setOpen] = useState(false)
  const last = weighings.data?.[0]
  return (
    <Card className="flex flex-col gap-3">
      <CardHeader
        icon={last && last.status !== 'match' ? TriangleAlert : Scale}
        title={t('integrity.weigh.title')}
        action={
          canAdd ? (
            <PlainButton icon={Scale} onClick={() => setOpen(true)}>
              {t('integrity.weigh.add')}
            </PlainButton>
          ) : undefined
        }
      />
      {last ? <WeighingResult w={last} /> : <p className="text-ink-2">{t('integrity.weigh.none')}</p>}
      <WeighSheet tripId={tripId} open={open} onOpenChange={setOpen} defaultTare={defaultTare} />
    </Card>
  )
}
