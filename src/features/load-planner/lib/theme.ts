// The app sets <html data-theme="light" | "dark"> (light by default — see the CONTRACT CHANGE REQUEST in
// PROGRESS.md). Until the theme switch exists the attribute is missing and the app is dark, so missing = dark.
// The 3D scene and the SVG drawings can't use Tailwind classes for every colour, so they pick from these palettes.
import { useEffect, useState } from 'react'

export type ThemeName = 'light' | 'dark'

export function currentTheme(): ThemeName {
  if (typeof document === 'undefined') return 'dark'
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

/** Follows <html data-theme> live (the theme switch changes it without a reload). */
export function useThemeName(): ThemeName {
  const [theme, setTheme] = useState<ThemeName>(currentTheme)
  useEffect(() => {
    const el = document.documentElement
    const obs = new MutationObserver(() => setTheme(currentTheme()))
    obs.observe(el, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return theme
}

export interface PlanPalette {
  canvas: string
  container: string
  containerFill: string
  edge: string
  grid: string
  /** solid colour for the 3D floor grid (three.js ignores rgba alpha) */
  grid3d: string
  door: string
  doorOpacity: number
  cab: string
  cabWindow: string
  /** outline of the selected box (lime on dark, dark olive on light so it shows on lime boxes) */
  selected: string
  /** box edges = stop colour mixed towards this */
  boxEdgeMix: string
  fragile: string
  issue: string
  /** safe zone + centre-of-gravity pin when balanced */
  balanceOk: string
}

export const PALETTES: Record<ThemeName, PlanPalette> = {
  dark: {
    canvas: '#0f0f11',
    container: '#1b1b1e',
    containerFill: '#a1a1a8',
    edge: '#6b6b73',
    grid: 'rgba(255,255,255,0.07)',
    grid3d: '#2a2a2f',
    door: '#e3f58c',
    doorOpacity: 0.4,
    cab: '#3a3a42',
    cabWindow: '#5a5f68',
    selected: '#e3f58c',
    boxEdgeMix: '#0a0a0b',
    fragile: '#f5a524',
    issue: '#ef4444',
    balanceOk: '#4ade80',
  },
  light: {
    canvas: '#f4f4f5',
    container: '#ffffff',
    containerFill: '#71717a',
    edge: '#a1a1aa',
    grid: 'rgba(0,0,0,0.08)',
    grid3d: '#dcdce0',
    door: '#65a30d',
    doorOpacity: 0.6,
    cab: '#d4d4d8',
    cabWindow: '#a1a1aa',
    selected: '#3f6212',
    boxEdgeMix: '#27272a',
    fragile: '#d97706',
    issue: '#dc2626',
    balanceOk: '#16a34a',
  },
}

export function usePlanPalette(): PlanPalette {
  return PALETTES[useThemeName()]
}
