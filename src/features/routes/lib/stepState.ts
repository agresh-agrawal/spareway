// trip.steps `done(props)` is synchronous, so the Route step remembers which trips have a chosen route
// (set when the route data loads or a route is chosen).
const chosen = new Map<string, boolean>()

export function setTripHasRoute(tripId: string, value: boolean) {
  chosen.set(tripId, value)
}

export function tripHasRoute(tripId: string): boolean {
  return chosen.get(tripId) === true
}
