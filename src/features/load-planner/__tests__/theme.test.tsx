import { act, renderHook } from '@testing-library/react'
import { PALETTES, useThemeName } from '../lib/theme'

afterEach(() => delete document.documentElement.dataset.theme)

describe('plan palette follows <html data-theme>', () => {
  it('dark until the app sets a theme, then switches live', async () => {
    const { result } = renderHook(() => useThemeName())
    expect(result.current).toBe('dark')
    await act(async () => {
      document.documentElement.dataset.theme = 'light'
    })
    expect(result.current).toBe('light')
    await act(async () => {
      document.documentElement.dataset.theme = 'dark'
    })
    expect(result.current).toBe('dark')
  })

  it('light palette never draws lime lines on white', () => {
    expect(PALETTES.light.selected).not.toBe('#e3f58c')
    expect(PALETTES.light.door).not.toBe('#e3f58c')
    expect(PALETTES.light.canvas).not.toBe(PALETTES.dark.canvas)
  })
})
