// React Query keys (Engineering Reference 2). staleTime 30 s; sign-out clears the cache.
export const queryKeys = {
  me: ['me'] as const,
  homeStats: ['home', 'stats'] as const,
  alerts: (open: boolean) => ['alerts', { open }] as const,
  alertsAll: ['alerts'] as const,
  activity: ['activity'] as const,
  fleetStats: (period: number) => ['fleetStats', period] as const,
  fleetStatsAll: ['fleetStats'] as const,
  trucks: ['trucks'] as const,
  truck: (id: string) => ['truck', id] as const,
  trips: (status?: string) => ['trips', { status }] as const,
  tripsAll: ['trips'] as const,
  trip: (id: string) => ['trip', id] as const,
  tripStops: (id: string) => ['trip', id, 'stops'] as const,
  tripCargo: (id: string) => ['trip', id, 'cargo'] as const,
  tripPlans: (id: string) => ['trip', id, 'plans'] as const,
  planProgress: (planId: string) => ['plan', planId, 'progress'] as const,
  tripRoutes: (id: string) => ['trip', id, 'routes'] as const,
  tripExtra: (id: string) => ['trip', id, 'extra'] as const,
  listings: (status?: string) => ['listings', { status }] as const,
  listingsAll: ['listings'] as const,
  pois: (bbox: string) => ['pois', bbox] as const,
  tripFinancials: (id: string) => ['tripFinancials', id] as const,
  loaderJob: (token: string) => ['loaderJob', token] as const,
  search: (q: string) => ['search', q] as const,
}

export const STALE_TIME_MS = 30_000
