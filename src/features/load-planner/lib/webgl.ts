let cached: boolean | null = null

/** Can this browser draw WebGL? No → the plan shows the top / side drawings only. */
export function hasWebGL(): boolean {
  if (cached !== null) return cached
  try {
    if (typeof document === 'undefined' || /jsdom/i.test(navigator.userAgent)) return (cached = false)
    const canvas = document.createElement('canvas')
    cached = Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    cached = false
  }
  return cached
}
