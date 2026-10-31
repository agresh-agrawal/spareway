import { useEffect, useRef, useState } from 'react'
import { Camera, FileText, Keyboard, ScanSearch, X } from 'lucide-react'
import { MainButton, PlainButton, Sheet } from '@/components/common'
import { useLang } from '@/lib/i18n'
import { toAppError } from '@/lib/errors'
import { analysePhotos, type AiResult, type Who } from '../api'
import { compressPhoto, type PhotoIn } from '../lib/image'

/** Camera (Design System 7.12): tip, 1–3 photos, Analyse ("Reading photos… about 10 s"). */
export function CameraSheet({
  open,
  onOpenChange,
  who,
  onResult,
  onTypeInstead,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  who: Who
  onResult: (r: AiResult, photoUrls: string[]) => void
  onTypeInstead: () => void
}) {
  const { t, lang } = useLang('smart-input')
  const input = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState<PhotoIn[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setPhotos([])
      setError(null)
    }
  }, [open])

  const addFiles = async (files: FileList | null) => {
    if (!files) return
    setError(null)
    for (const f of Array.from(files).slice(0, 3 - photos.length)) {
      try {
        const p = await compressPhoto(f)
        setPhotos((ps) => (ps.length < 3 ? [...ps, p] : ps))
      } catch {
        setError(t('cam.tooLarge'))
      }
    }
  }

  const remove = (url: string) => {
    URL.revokeObjectURL(url)
    setPhotos((ps) => ps.filter((p) => p.url !== url))
  }

  const analyse = async () => {
    setBusy(true)
    setError(null)
    try {
      const r = await analysePhotos(who, photos, lang)
      onResult(r, photos.map((p) => p.url))
    } catch (e) {
      const code = toAppError(e).code
      setError(code === 'TOO_LARGE' ? t('cam.tooLarge') : code === 'LINK_INVALID' || code === 'AUTH_REQUIRED' ? t(`common:errors.${code}`) : t('cam.failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      title={t('cam.title')}
      footer={
        <MainButton icon={ScanSearch} onClick={analyse} loading={busy} disabled={photos.length === 0} className="w-full">
          {error && photos.length > 0 ? t('cam.retry') : t('cam.analyse')}
        </MainButton>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 rounded-tile border border-line bg-surface-2 p-3">
          <FileText size={28} className="shrink-0 text-accent" aria-hidden />
          <p className="font-medium">{t('cam.tip')}</p>
        </div>

        <input
          ref={input}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            void addFiles(e.target.files)
            e.target.value = ''
          }}
        />

        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <div key={p.url} className="relative aspect-square overflow-hidden rounded-tile border border-line">
              <img src={p.url} alt="" className="size-full object-cover" />
              <button
                type="button"
                aria-label={t('cam.remove')}
                onClick={() => remove(p.url)}
                disabled={busy}
                className="absolute top-1 right-1 flex size-9 items-center justify-center rounded-full bg-black/70 text-white"
              >
                <X size={18} />
              </button>
            </div>
          ))}
          {photos.length < 3 && (
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={busy}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-tile border-2 border-dashed border-line-strong text-ink-2 hover:border-accent hover:text-ink"
            >
              <Camera size={36} aria-hidden />
              <span className="px-1 text-center text-[14px] font-semibold">{photos.length === 0 ? t('cam.take') : t('cam.more')}</span>
            </button>
          )}
        </div>
        <p className="text-label text-ink-3">{t('cam.count', { n: photos.length })}</p>

        {busy && (
          <p className="text-center font-medium text-ink-2" role="status">
            {t('cam.reading')}
          </p>
        )}
        {error && (
          <p className="rounded-tile border border-crit/40 bg-crit/10 p-3 text-crit" role="alert">
            {error}
          </p>
        )}
        <p className="text-label text-ink-3">{t('cam.blocked')}</p>
        <PlainButton icon={Keyboard} onClick={onTypeInstead} disabled={busy}>
          {t('cam.typeInstead')}
        </PlainButton>
      </div>
    </Sheet>
  )
}
