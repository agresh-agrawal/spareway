// Public API of the offline feature (Architecture F21).
export { OfflineLayer } from './components/OfflineLayer'
export { persistOptions, shouldSave, clearSavedData } from './lib/persist'
export { enqueue, registerSender, replayQueue, readQueue, isOfflineError } from './lib/queue'
export { useOnline } from './lib/online'
export { useInstall } from './lib/install'
