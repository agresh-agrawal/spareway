// Light / Dark theme (owner's request: light by default). The app always sets <html data-theme="light" | "dark">;
// the choice is saved on this device. index.html applies it before React starts, so there is no dark flash.
import { useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'
export const THEME_KEY = 'spareway.theme'

function read(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function applyTheme(theme: Theme) {
  const el = document.documentElement
  el.dataset.theme = theme
  el.style.colorScheme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0a0a0b' : '#f5f6f2')
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    /* storage blocked */
  }
}

function subscribe(fn: () => void) {
  const obs = new MutationObserver(fn)
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => obs.disconnect()
}

const current = (): Theme => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')

/** { theme, setTheme, toggle } — follows <html data-theme> live. */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, current, () => 'light' as Theme)
  return { theme, setTheme: applyTheme, toggle: () => applyTheme(theme === 'dark' ? 'light' : 'dark') }
}

/** Called once at start-up (index.html already did it; this keeps tests and odd browsers right). */
export function initTheme() {
  if (typeof document !== 'undefined') applyTheme(read())
}
