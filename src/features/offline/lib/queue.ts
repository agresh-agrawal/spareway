// Offline queue (Architecture F21): owner cargo adds and loader Done / Problem taps made without internet are kept on the
// phone (localStorage) and sent later in the order they were made. Features register how to send each kind.
import { toAppError } from '@/lib/errors'

export interface QueueItem<P = unknown> {
  id: string
  kind: string
  payload: P
  at: string
}

const KEY = 'spareway.queue'
const EVENT = 'spareway:queue'

type Sender = (payload: never) => Promise<void>
const senders = new Map<string, Sender>()

/** Each feature says how to send its kind (cargo_add, loader_step …). */
export function registerSender<P>(kind: string, send: (payload: P) => Promise<void>) {
  senders.set(kind, send as Sender)
}

export function readQueue(): QueueItem[] {
  try {
    const raw = localStorage.getItem(KEY)
    const list = raw ? (JSON.parse(raw) as QueueItem[]) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function writeQueue(list: QueueItem[]) {
  try {
    if (list.length) localStorage.setItem(KEY, JSON.stringify(list))
    else localStorage.removeItem(KEY)
  } catch {
    /* storage full or blocked — nothing more we can do */
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT))
}

export function enqueue<P>(kind: string, payload: P): QueueItem<P> {
  const item: QueueItem<P> = { id: crypto.randomUUID(), kind, payload, at: new Date().toISOString() }
  writeQueue([...readQueue(), item])
  return item
}

export function clearQueue() {
  writeQueue([])
}

export function onQueueChange(fn: () => void): () => void {
  window.addEventListener(EVENT, fn)
  window.addEventListener('storage', fn)
  return () => {
    window.removeEventListener(EVENT, fn)
    window.removeEventListener('storage', fn)
  }
}

/** No internet (browser says so, or the request never reached the server). */
export function isOfflineError(e: unknown): boolean {
  return (typeof navigator !== 'undefined' && navigator.onLine === false) || toAppError(e).code === 'NETWORK'
}

export interface ReplayResult {
  sent: number
  /** refused by the server (e.g. PLAN_CHANGED) — removed, the user is told */
  dropped: { item: QueueItem; code: string }[]
  /** still waiting (no internet again, or no sender registered on this page) */
  left: number
}

let running: Promise<ReplayResult> | null = null

/**
 * Send the queue in order. Stops at the first network failure (keeps that item and everything after it, so order is kept);
 * an item the server refuses is dropped and reported. Kinds without a sender on this page are kept for later.
 */
export function replayQueue(): Promise<ReplayResult> {
  if (running) return running
  running = (async () => {
    const result: ReplayResult = { sent: 0, dropped: [], left: 0 }
    for (const item of readQueue()) {
      const send = senders.get(item.kind)
      if (!send) continue
      try {
        await send(item.payload as never)
        result.sent++
      } catch (e) {
        if (isOfflineError(e)) break
        result.dropped.push({ item, code: toAppError(e).code })
      }
      writeQueue(readQueue().filter((x) => x.id !== item.id))
    }
    result.left = readQueue().length
    return result
  })().finally(() => {
    running = null
  })
  return running
}
