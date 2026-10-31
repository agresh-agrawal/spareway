// Public API of extra-loads for other features (Architecture F19, F20). Import only from here.
export { evaluateCandidates, listingPackItems, corridorKm, type Candidate, type ListingInput, type SpaceCheck } from './lib/candidates'
export { checkSpace } from './lib/space'
export { useExtraLoads, addToTrip } from './hooks'
