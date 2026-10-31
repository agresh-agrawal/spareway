import { useEffect, useState, type KeyboardEvent } from 'react'
import { ArrowRight, Keyboard, Mic } from 'lucide-react'
import { MainButton, PlainButton, Sheet, TextField } from '@/components/common'
import { useLang } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import type { Lang } from '@/types/domain'
import { analyseWords, type AiResult, type Who } from '../api'
import type { SuggestedItem } from '../lib/validate'
import { parseLengthAnswer, parseVoice } from '../voice/parse'
import { useSpeech } from '../voice/useSpeech'

type Dim = 'length' | 'width' | 'height'
const FIELD: Record<Dim, 'lengthCm' | 'widthCm' | 'heightCm'> = { length: 'lengthCm', width: 'widthCm', height: 'heightCm' }
const ASK: Record<Dim, string> = { length: 'voice.askLength', width: 'voice.askWidth', height: 'voice.askHeight' }

function MicButton({ listening, onStart, onStop, label }: { listening: boolean; onStart: () => void; onStop: () => void; label: string }) {
  const key = (e: KeyboardEvent, down: boolean) => {
    if (e.key !== ' ' && e.key !== 'Enter') return
    e.preventDefault()
    if (down && !e.repeat) onStart()
    if (!down) onStop()
  }
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={listening}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId)
        onStart()
      }}
      onPointerUp={onStop}
      onPointerCancel={onStop}
      onKeyDown={(e) => key(e, true)}
      onKeyUp={(e) => key(e, false)}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        'flex size-20 touch-none items-center justify-center rounded-full select-none transition-transform',
        listening ? 'scale-110 bg-crit text-white shadow-[0_0_0_10px_rgba(239,68,68,0.25)]' : 'bg-accent text-accent-ink',
      )}
    >
      <Mic size={36} aria-hidden />
    </button>
  )
}

/** Voice (Design System 7.12): hold-to-talk mic, live text, हिंदी/English, question for a missing size, "Type instead". */
export function VoiceSheet({
  open,
  onOpenChange,
  who,
  startTyping = false,
  onResult,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  who: Who
  startTyping?: boolean
  onResult: (r: AiResult) => void
}) {
  const { t, lang } = useLang('smart-input')
  const [speechLang, setSpeechLang] = useState<Lang>(lang)
  const speech = useSpeech(speechLang)
  const [typing, setTyping] = useState(startTyping)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  // missing-size questions
  const [items, setItems] = useState<SuggestedItem[] | null>(null)
  const [queue, setQueue] = useState<{ i: number; dim: Dim }[]>([])
  const [answer, setAnswer] = useState('')

  useEffect(() => {
    if (open) {
      setTyping(startTyping || !speech.supported)
      setSpeechLang(lang)
      speech.setText('')
      setProblem(null)
      setItems(null)
      setQueue([])
      setAnswer('')
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // while a question is open, what is heard is the answer
  useEffect(() => {
    if (items && speech.text) setAnswer(speech.text)
  }, [speech.text]) // eslint-disable-line react-hooks/exhaustive-deps

  const speechProblem =
    speech.error === 'MIC_BLOCKED' ? t('voice.micBlocked') : speech.error === 'NOTHING_HEARD' && !speech.listening ? t('voice.nothing') : speech.error ? t('voice.failed') : null

  const finish = (list: SuggestedItem[]) => onResult({ scanId: null, imagePaths: [], items: list, warnings: [] })

  const next = async () => {
    const text = speech.text.trim()
    if (!text) {
      setProblem(t('voice.nothing'))
      return
    }
    setProblem(null)
    let r = parseVoice(text)
    let list: SuggestedItem[] = r.items
    if (r.unsure || list.length === 0) {
      // the rule parser is unsure → ask ai-cargo (voice mode); keep the rule result if that fails
      setBusy(true)
      try {
        const ai = await analyseWords(who, text, speechLang)
        if (ai.items.length) {
          list = ai.items
          r = { ...r, missing: [] }
        }
      } catch {
        /* keep the rule parser's answer */
      } finally {
        setBusy(false)
      }
    }
    if (list.length === 0) {
      setProblem(t('voice.failed'))
      return
    }
    const q = list.flatMap((it, i) => (['length', 'width', 'height'] as Dim[]).filter((d) => !(it[FIELD[d]] > 0)).map((dim) => ({ i, dim })))
    if (q.length === 0) return finish(list)
    setItems(list)
    setQueue(q)
    setAnswer('')
    speech.setText('')
  }

  const answerQuestion = (skip: boolean) => {
    if (!items || queue.length === 0) return
    const [cur, ...rest] = queue
    let list = items
    if (!skip) {
      const cm = parseLengthAnswer(answer)
      if (cm === null || cm <= 0) {
        setProblem(t('voice.answerMissing'))
        return
      }
      list = items.map((it, i) => (i === cur.i ? { ...it, [FIELD[cur.dim]]: cm } : it))
    }
    setProblem(null)
    setAnswer('')
    speech.setText('')
    if (rest.length === 0) return finish(list)
    setItems(list)
    setQueue(rest)
  }

  const current = items && queue[0]
  const langSwitch = (
    <div className="flex rounded-control border border-line-strong bg-surface-2 p-1" role="group" aria-label={t('voice.title')}>
      {(['hi', 'en'] as const).map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={speechLang === l}
          onClick={() => setSpeechLang(l)}
          className={cn('h-10 min-w-20 rounded-[10px] px-3 text-[15px] font-semibold', speechLang === l ? 'bg-accent text-accent-ink' : 'text-ink-2')}
        >
          {l === 'hi' ? 'हिंदी' : 'English'}
        </button>
      ))}
    </div>
  )

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      dirty={Boolean(speech.text || items)}
      title={t('voice.title')}
      footer={
        current ? (
          <MainButton icon={ArrowRight} onClick={() => answerQuestion(false)} className="w-full">
            {t('voice.ok')}
          </MainButton>
        ) : (
          <MainButton icon={ArrowRight} onClick={next} loading={busy} className="w-full">
            {t('voice.next')}
          </MainButton>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {current ? (
          <>
            <p className="text-label text-ink-2">{t('voice.askItem', { label: items![current.i].label, n: current.i + 1 })}</p>
            <p className="text-section-title font-semibold">{t(ASK[current.dim])}</p>
            {speech.supported && !typing && (
              <div className="flex flex-col items-center gap-2 py-2">
                <MicButton listening={speech.listening} onStart={speech.start} onStop={speech.stop} label={t('voice.hold')} />
                <span className="text-label text-ink-2">{speech.listening ? t('voice.listening') : t('voice.hold')}</span>
              </div>
            )}
            <TextField label={t('voice.answer')} help={t('voice.answerHelp')} value={answer} inputMode="text" onChange={(e) => setAnswer(e.target.value)} />
            <PlainButton onClick={() => answerQuestion(true)}>{t('voice.skip')}</PlainButton>
          </>
        ) : (
          <>
            {speech.supported && langSwitch}
            {!typing ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <MicButton listening={speech.listening} onStart={speech.start} onStop={speech.stop} label={t('voice.hold')} />
                <span className="font-medium text-ink-2">{speech.listening ? t('voice.listening') : t('voice.hold')}</span>
                <p className="text-center text-label text-ink-3">{t('voice.example')}</p>
              </div>
            ) : (
              !speech.supported && <p className="rounded-tile border border-line bg-surface-2 p-3 text-ink-2">{t('voice.noSpeech')}</p>
            )}
            <label className="flex flex-col gap-1.5">
              <span className="text-label font-medium text-ink-2">{typing ? t('voice.typeHere') : t('voice.heard')}</span>
              <textarea
                value={speech.text}
                onChange={(e) => speech.setText(e.target.value)}
                rows={3}
                placeholder={typing ? t('voice.typeHelp') : ''}
                className="w-full rounded-control border border-line-strong bg-surface-2 p-3 text-[16px] text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
              />
            </label>
            {speech.supported && (
              <PlainButton icon={typing ? Mic : Keyboard} onClick={() => setTyping((v) => !v)}>
                {typing ? t('voice.speakInstead') : t('voice.typeInstead')}
              </PlainButton>
            )}
          </>
        )}
        {(problem ?? speechProblem) && (
          <p className="rounded-tile border border-warn/40 bg-warn/10 p-3 text-warn" role="alert">
            {problem ?? speechProblem}
          </p>
        )}
      </div>
    </Sheet>
  )
}
