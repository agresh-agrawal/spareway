import { Home, Truck } from 'lucide-react'
import { buildNav, collectModules, slotEntries } from './modules'
import type { FeatureModule } from '@/types/domain'
import { setupI18n } from '@/i18n/setup'

setupI18n('en')

const Dummy = () => null

const mods = (): Record<string, { default: FeatureModule }> => ({
  '../features/trucks/module.tsx': {
    default: {
      id: 'trucks',
      order: 10,
      nav: { labelKey: 'common:nav.trucks', icon: Truck, path: '/trucks', phone: 'tab' },
      slots: {
        'home.actions': [{ id: 'new-truck', order: 20, component: Dummy }],
        'trip.steps': [{ id: 'never', order: 1, component: Dummy, when: (p) => p.tripId === 'x' }],
      },
    },
  },
  '../features/home/module.tsx': {
    default: {
      id: 'home',
      order: 0,
      nav: { labelKey: 'common:nav.home', icon: Home, path: '/', phone: 'tab' },
      slots: { 'home.actions': [{ id: 'new-trip', order: 10, component: Dummy }] },
    },
  },
  '../features/auth/module.tsx': { default: { id: 'auth', order: 100 } },
})

describe('module discovery', () => {
  it('sorts modules by order', () => {
    expect(collectModules(mods()).map((m) => m.id)).toEqual(['home', 'trucks', 'auth'])
  })

  it('builds nav only from modules that exist and have nav', () => {
    const nav = buildNav(collectModules(mods()))
    expect(nav.map((n) => n.id)).toEqual(['home', 'trucks'])
    expect(nav.find((n) => n.path === '/map')).toBeUndefined()
  })
})

describe('slots', () => {
  it('orders entries across modules', () => {
    const e = slotEntries(collectModules(mods()), 'home.actions', {})
    expect(e.map((x) => x.id)).toEqual(['new-trip', 'new-truck'])
  })

  it('filters by when(props) and returns [] for empty slots', () => {
    const m = collectModules(mods())
    expect(slotEntries(m, 'trip.steps', { tripId: 'y' })).toEqual([])
    expect(slotEntries(m, 'trip.steps', { tripId: 'x' }).map((x) => x.id)).toEqual(['never'])
    expect(slotEntries(m, 'loader.actions', { token: 't', job: {} as never })).toEqual([])
  })
})

describe('real modules', () => {
  it('Phase 0 ships home, auth and settings with matching ids', async () => {
    const { getModules } = await import('./modules')
    const ids = getModules().map((m) => m.id)
    expect(ids).toEqual(expect.arrayContaining(['home', 'auth', 'settings']))
  })
})
