import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import commonEn from './common/en.json'
import commonHi from './common/hi.json'
import dataHi from './data/hi.json'
import type { Lang } from '@/types/domain'

export const LANG_KEY = 'spareway.lang'

/** Saved device choice → browser (hi* → Hindi) → English */
export function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY)
    if (saved === 'en' || saved === 'hi') return saved
  } catch {
    /* storage blocked */
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'en'
  return nav?.toLowerCase().startsWith('hi') ? 'hi' : 'en'
}

export function setupI18n(lang: Lang = initialLang()) {
  if (i18n.isInitialized) return i18n
  i18n.use(initReactI18next).init({
    lng: lang,
    fallbackLng: 'en',
    supportedLngs: ['en', 'hi'],
    ns: ['common', 'data'],
    defaultNS: 'common',
    resources: {
      en: { common: commonEn, data: {} },
      hi: { common: commonHi, data: dataHi },
    },
    interpolation: { escapeValue: false },
    // keys in the data namespace are the stored English text (may contain ':' and '.')
    keySeparator: '.',
    nsSeparator: ':',
    returnEmptyString: false,
    react: { useSuspense: false },
    initAsync: false,
  })
  if (typeof document !== 'undefined') document.documentElement.lang = lang
  return i18n
}

/** Feature modules register their own namespace (= module id). */
export function registerNamespace(id: string, res: { en: Record<string, unknown>; hi: Record<string, unknown> }) {
  i18n.addResourceBundle('en', id, res.en, true, true)
  i18n.addResourceBundle('hi', id, res.hi, true, true)
}

export const demoDictionary = dataHi as Record<string, string>

export default i18n
