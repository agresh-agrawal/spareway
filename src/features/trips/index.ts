// Public API of the trips feature (Architecture F8).
export { places, searchPlaces, type Place } from './lib/places'
export { unloadOrderForStops } from './lib/stops'
export { useTrip, useTripStops, useTrips } from './hooks'
export { StopChip } from '@/components/common'
export type { Trip, TripOverview, TripStop } from './api'
