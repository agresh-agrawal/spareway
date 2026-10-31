import { useEffect, useState } from 'react'

/** Seconds left before an action may run again (e.g. Resend after 60 s). */
export function useCooldown(initial = 0) {
  const [left, setLeft] = useState(initial)
  useEffect(() => {
    if (left <= 0) return
    const id = setTimeout(() => setLeft((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [left])
  return { left, start: (s = 60) => setLeft(s) }
}
