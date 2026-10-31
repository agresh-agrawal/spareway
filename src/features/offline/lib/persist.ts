// Saved data for offline use (Architecture F21): React Query cache in localStorage, restored on start.
// Never kept: loader job data, search results, failed queries. Fixture mode keeps nothing (the sample store lives in memory).
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { removeOldestQuery, type PersistQueryClientOptions } from '@tanstack/react-query-persist-client'
import type { Query } from '@tanstack/react-query'

export const CACHE_KEY = 'spareway.cache'
const DAY = 24 * 3_600_000
const SKIP = new Set(['loaderJob', 'search'])

export function shouldSave(q: Pick<Query, 'queryKey' | 'state'>): boolean {
  return q.state.status === 'success' && !SKIP.has(String(q.queryKey[0]))
}

const persister = createSyncStoragePersister({
  storage: typeof window === 'undefined' ? undefined : window.localStorage,
  key: CACHE_KEY,
  throttleTime: 2000,
  retry: removeOldestQuery,
})

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister,
  maxAge: 7 * DAY,
  buster: 'v4',
  dehydrateOptions: { shouldDehydrateQuery: shouldSave },
}

/** Sign-out: forget everything saved on this phone. */
export function clearSavedData() {
  void persister.removeClient()
}
