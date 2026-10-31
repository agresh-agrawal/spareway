// `trip.steps` done() is synchronous: the Loader step marks a trip here once its link exists or loading started.
const done = new Set<string>()

export function markLoaderStep(tripId: string, isDone: boolean) {
  if (isDone) done.add(tripId)
  else done.delete(tripId)
}

export function loaderStepDone(tripId: string): boolean {
  return done.has(tripId)
}
