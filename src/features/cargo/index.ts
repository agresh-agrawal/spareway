// Public API of the cargo feature (Architecture F9).
export { CargoList } from './components/CargoList'
export { useCargoItems } from './hooks'
export { cargoTotals } from './lib/totals'
export type { CargoItem, Weighing } from './api'
// cargo data checks (anti-poisoning): the same rules as the database guard, for every entry path
export { checkCargo, needsEvidence, type IntegrityResult, type IntegrityTruck } from './lib/integrity'
export {
  guardCargo,
  integrityDefaults,
  logChange,
  LOCKED_STATUSES,
  fixtureWeighing,
} from './lib/fixtureGuard'
export { IntegrityNotes, cargoErrorKey } from './components/IntegrityNotes'
export { WeighingResult, currentPosition } from './components/WeighbridgeCard'
