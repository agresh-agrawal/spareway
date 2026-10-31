// trip.steps `done(props)` is synchronous, so the Extra loads step remembers which trips got an extra load
// (set when the step data loads or a load is added).
const added = new Map<string, boolean>()

export function setTripHasExtra(tripId: string, value: boolean) {
  added.set(tripId, value)
}

export function tripHasExtra(tripId: string): boolean {
  return added.get(tripId) === true
}
