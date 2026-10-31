import type { FeatureModule, NavItem, SlotEntry, SlotName, SlotProps } from '@/types/domain'
import { registerNamespace } from '@/i18n/setup'

type ModuleRecord = Record<string, { default: FeatureModule }>

/** Sorted, validated modules from an import.meta.glob record. Pure → testable. */
export function collectModules(record: ModuleRecord): FeatureModule[] {
  return Object.entries(record)
    .map(([path, mod]) => {
      const m = mod.default
      const folder = path.match(/features\/([^/]+)\/module\.tsx$/)?.[1]
      if (folder && m.id !== folder) console.warn(`module id "${m.id}" should equal its folder "${folder}"`)
      return m
    })
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
}

/** Nav items of the features that exist (missing features → no item). */
export function buildNav(modules: FeatureModule[]): (NavItem & { id: string; order: number })[] {
  return modules.filter((m) => m.nav).map((m) => ({ ...(m.nav as NavItem), id: m.id, order: m.order }))
}

/** Every entry for a slot across modules, sorted by order, filtered by when(props). */
export function slotEntries<N extends SlotName>(
  modules: FeatureModule[],
  name: N,
  props: SlotProps[N],
): SlotEntry<SlotProps[N]>[] {
  const all: SlotEntry<SlotProps[N]>[] = []
  for (const m of modules) {
    const list = m.slots?.[name] as SlotEntry<SlotProps[N]>[] | undefined
    if (list) all.push(...list)
  }
  return all
    .filter((e) => (e.when ? e.when(props) : true))
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
}

let cache: FeatureModule[] | null = null

/** The app's modules: features/*\/module.tsx, found at build time. */
export function getModules(): FeatureModule[] {
  if (cache) return cache
  const record = import.meta.glob<{ default: FeatureModule }>('../features/*/module.tsx', { eager: true })
  cache = collectModules(record)
  for (const m of cache) if (m.i18n) registerNamespace(m.id, m.i18n)
  return cache
}
