// Browser speech recognition (Chrome / Edge: webkitSpeechRecognition) in hi-IN or en-IN. Other browsers → typed input.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Lang } from '@/types/domain'

interface RecResult {
  0: { transcript: string }
  isFinal: boolean
}
interface Rec {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((e: { resultIndex: number; results: ArrayLike<RecResult> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type RecCtor = new () => Rec

function ctor(): RecCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export const speechSupported = () => ctor() !== null

export type SpeechError = 'NOTHING_HEARD' | 'MIC_BLOCKED' | 'FAILED'

/** Hold-to-talk: start() on press, stop() on release. `text` = everything heard so far (final + live). */
export function useSpeech(lang: Lang) {
  const rec = useRef<Rec | null>(null)
  const finalText = useRef('')
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<SpeechError | null>(null)

  useEffect(() => () => rec.current?.abort(), [])

  const start = useCallback(() => {
    const C = ctor()
    if (!C || rec.current) return
    const r = new C()
    r.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'
    r.interimResults = true
    r.continuous = true
    finalText.current = ''
    let heard = false
    r.onresult = (e) => {
      let live = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        if (res.isFinal) finalText.current = `${finalText.current} ${res[0].transcript}`.trim()
        else live += res[0].transcript
      }
      heard = true
      setText(`${finalText.current} ${live}`.trim())
    }
    r.onerror = (e) => setError(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'MIC_BLOCKED' : e.error === 'no-speech' ? 'NOTHING_HEARD' : 'FAILED')
    r.onend = () => {
      rec.current = null
      setListening(false)
      if (!heard) setError((prev) => prev ?? 'NOTHING_HEARD')
    }
    setError(null)
    setText('')
    rec.current = r
    try {
      r.start()
      setListening(true)
    } catch {
      rec.current = null
      setError('FAILED')
    }
  }, [lang])

  const stop = useCallback(() => rec.current?.stop(), [])

  return { supported: speechSupported(), text, setText, listening, error, start, stop }
}
