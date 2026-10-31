import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

const KEY = 'spareway.lowData'

interface LowDataCtx {
  lowData: boolean
  setLowData: (on: boolean) => void
  toggle: () => void
}

const Ctx = createContext<LowDataCtx>({ lowData: false, setLowData: () => {}, toggle: () => {} })

function readStored(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/** Low-data mode: lite map, 3D off by default, no animations, slower polling. Saved on the device. */
export function LowDataProvider({ children }: { children: ReactNode }) {
  const [lowData, setState] = useState(readStored)

  const setLowData = useCallback((on: boolean) => {
    setState(on)
    try {
      localStorage.setItem(KEY, on ? '1' : '0')
    } catch {
      /* private mode — keep in memory */
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.lowData = lowData ? 'on' : 'off'
  }, [lowData])

  const value = useMemo(() => ({ lowData, setLowData, toggle: () => setLowData(!lowData) }), [lowData, setLowData])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useLowData() {
  return useContext(Ctx)
}

/** Reduced motion from the OS or low-data mode → no animation */
export function useReducedMotion(): boolean {
  const { lowData } = useLowData()
  const [prefers, setPrefers] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const on = () => setPrefers(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return lowData || Boolean(prefers)
}
