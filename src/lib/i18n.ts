import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import i18n, { demoDictionary, LANG_KEY } from '@/i18n/setup'
import type { Lang, UseLang } from '@/types/domain'

type Meta = Record<string, unknown>

/** Translate a stored demo value (place, cargo, truck model, alert text) when Hindi is on. */
export function td(value: string | null | undefined, lang: Lang = currentLang()): string {
  if (value === null || value === undefined) return ''
  if (lang !== 'hi') return value
  return demoDictionary[value] ?? value
}

export function currentLang(): Lang {
  return i18n.language === 'hi' ? 'hi' : 'en'
}

// meta keys that hold stored place/goods names → go through td()
const PLACE_KEYS = new Set(['city', 'pickup', 'drop'])

/**
 * Alert / activity line from kind + meta (Engineering Reference 7.7). Seeded rows have no meta:
 * then the stored fallback text goes through td().
 */
export function tm(kind: string, meta: Meta | null | undefined, fallback = '', lang: Lang = currentLang()): string {
  const key = `common:templates.${kind}`
  const hasMeta = meta && typeof meta === 'object' && Object.keys(meta).length > 0
  if (!hasMeta || !i18n.exists(key, { lng: lang })) return td(fallback, lang)
  const values: Meta = {}
  for (const [k, v] of Object.entries(meta)) {
    if (typeof v === 'string' && PLACE_KEYS.has(k)) values[k] = td(v, lang)
    else values[k] = v
  }
  if (kind === 'loader_cargo' && typeof meta.source === 'string') {
    values.source = i18n.t(`common:templates.sources.${meta.source}`, { lng: lang, defaultValue: meta.source })
  }
  if (kind === 'truck_status' && typeof meta.status === 'string') {
    values.status = i18n.t(`common:truckStatus.${meta.status}`, { lng: lang, defaultValue: meta.status })
  }
  return i18n.t(key, { ...values, lng: lang })
}

let persist: ((lang: Lang) => void) | null = null

/** AuthProvider registers this so the choice is saved to profiles.preferred_lang. */
export function setLangPersister(fn: ((lang: Lang) => void) | null) {
  persist = fn
}

export function applyLang(lang: Lang, save = true) {
  if (i18n.language !== lang) void i18n.changeLanguage(lang)
  if (typeof document !== 'undefined') document.documentElement.lang = lang
  try {
    localStorage.setItem(LANG_KEY, lang)
  } catch {
    /* storage blocked */
  }
  if (save) persist?.(lang)
}

/** useLang() → { lang, toggle, set } plus t / td / tm bound to the current language. */
export function useLang(ns?: string | string[]): UseLang & {
  t: ReturnType<typeof useTranslation>['t']
  td: (v: string | null | undefined) => string
  tm: (kind: string, meta: Meta | null | undefined, fallback?: string) => string
} {
  const { t, i18n: inst } = useTranslation(ns ?? 'common')
  const lang: Lang = inst.language === 'hi' ? 'hi' : 'en'
  const set = useCallback((l: Lang) => applyLang(l), [])
  const toggle = useCallback(() => applyLang(lang === 'hi' ? 'en' : 'hi'), [lang])
  return useMemo(
    () => ({
      lang,
      set,
      toggle,
      t,
      td: (v: string | null | undefined) => td(v, lang),
      tm: (kind: string, meta: Meta | null | undefined, fallback = '') => tm(kind, meta, fallback, lang),
    }),
    [lang, set, toggle, t],
  )
}
