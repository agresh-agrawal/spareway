// trip.steps `done(props)` is synchronous, so the Load plan step remembers which trips have an active plan
// (filled by usePlanForTrip / useActivePlanFlag whenever plans load or a plan is activated).
const active = new Map<string, boolean>()

export function setTripHasActivePlan(tripId: string, value: boolean) {
  active.set(tripId, value)
}

export function tripHasActivePlan(tripId: string): boolean {
  return active.get(tripId) === true
}
