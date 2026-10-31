import { useRef, useState } from 'react'
import { Download, Map as MapIcon, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardHeader, PlainButton } from '@/components/common'
import { useLang } from '@/lib/i18n'
import { formatDate } from '@/lib/format'
import { useOnline } from '../lib/online'
import { readSavedMap, removeMap, saveMap, type SavedMap } from '../lib/mapCache'

/** Settings slot: "Save map for offline (NH48)". */
export function SaveMapSection() {
  const { t, lang } = useLang('offline')
  const online = useOnline()
  const [saved, setSaved] = useState<SavedMap | null>(readSavedMap)
  const [pct, setPct] = useState<number | null>(null)
  const abort = useRef<AbortController | null>(null)
  const supported = typeof window !== 'undefined' && 'caches' in window

  const start = async () => {
    abort.current = new AbortController()
    setPct(0)
    try {
      setSaved(await saveMap((d, n) => setPct(Math.round((d / n) * 100)), abort.current.signal))
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast.error(t('map.failed'))
    } finally {
      setPct(null)
      abort.current = null
    }
  }

  const remove = async () => {
    await removeMap()
    setSaved(null)
    toast.success(t('map.removed'))
  }

  return (
    <Card>
      <CardHeader icon={MapIcon} title={t('map.title')} />
      <p className="mb-4 text-ink-2">{t('map.help')}</p>
      {!supported ? (
        <p className="text-ink-3">{t('map.notSupported')}</p>
      ) : pct !== null ? (
        <div className="flex flex-col gap-3" role="status">
          <span className="font-medium">{t('map.saving', { pct })}</span>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-3" aria-hidden>
            <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
          </div>
          <PlainButton onClick={() => abort.current?.abort()}>{t('map.cancel')}</PlainButton>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {saved && <p className="font-medium text-ok">{t('map.saved', { date: formatDate(saved.at, lang), mb: Math.round(saved.bytes / 1_048_576) })}</p>}
          {!online && <p className="text-label text-warn">{t('map.needsOnline')}</p>}
          <div className="flex flex-wrap gap-2">
            <PlainButton icon={Download} onClick={start} disabled={!online}>
              {saved ? t('map.update') : t('map.save')}
            </PlainButton>
            {saved && (
              <PlainButton icon={Trash2} tone="danger" onClick={remove}>
                {t('map.remove')}
              </PlainButton>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}
