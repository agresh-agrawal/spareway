import { Suspense, useMemo, type ReactNode } from 'react'
import type { SlotEntry, SlotName, SlotProps } from '@/types/domain'
import { getModules, slotEntries } from './modules'

/** Entries other features plugged into this slot (empty slot → []). */
export function useSlot<N extends SlotName>(name: N, props: SlotProps[N]): SlotEntry<SlotProps[N]>[] {
  const key = JSON.stringify(props, (_k, v) => (typeof v === 'function' ? undefined : v))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => slotEntries(getModules(), name, props), [name, key])
}

/**
 * Renders every component plugged into `name`. An empty slot renders nothing, so every phase looks
 * complete. `wrap` lets the host lay out each entry (e.g. grid cells).
 */
export function Slot<N extends SlotName>({
  name,
  props,
  wrap,
  fallback = null,
}: {
  name: N
  props: SlotProps[N]
  wrap?: (node: ReactNode, entry: SlotEntry<SlotProps[N]>) => ReactNode
  fallback?: ReactNode
}) {
  const entries = useSlot(name, props)
  if (entries.length === 0) return <>{fallback}</>
  return (
    <>
      {entries.map((e) => {
        const C = e.component
        const node = (
          <Suspense key={e.id} fallback={null}>
            <C {...props} />
          </Suspense>
        )
        return wrap ? <SlotItem key={e.id}>{wrap(node, e)}</SlotItem> : node
      })}
    </>
  )
}

function SlotItem({ children }: { children: ReactNode }) {
  return <>{children}</>
}
