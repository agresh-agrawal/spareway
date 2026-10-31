import type { FeatureModule } from '@/types/domain'
import { registerSender } from '@/features/offline'
import { saveCargo } from './api'
import type { CargoValues } from './schemas'
import en from './i18n/en.json'
import hi from './i18n/hi.json'

/** Cargo has no route of its own: it is trip step 1, rendered by the trip page through `CargoList`. */
const cargo: FeatureModule = {
  id: 'cargo',
  order: 25,
  i18n: { en, hi },
}

// owner cargo lines added without internet (Phase 4·Code F21)
registerSender<{ tripId: string; values: CargoValues }>('cargo_add', async ({ tripId, values }) => {
  await saveCargo(tripId, values)
})

export default cargo
