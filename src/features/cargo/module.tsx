import type { FeatureModule } from '@/types/domain'
import en from './i18n/en.json'
import hi from './i18n/hi.json'

/** Cargo has no route of its own: it is trip step 1, rendered by the trip page through `CargoList`. */
const cargo: FeatureModule = {
  id: 'cargo',
  order: 25,
  i18n: { en, hi },
}

export default cargo
