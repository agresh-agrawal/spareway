import type { PackContainer, PackItem, Placement } from '@/types/domain'
import { buildPackItems, computeInputHash, fitAdditional, pack, sha256Hex, validatePlan } from '..'
import { cube, demoTripInput, overPayloadInput } from '../__fixtures__/demoTrip'

const box = (key: string, l: number, w: number, h: number, extra: Partial<PackItem> = {}): PackItem => ({
  key: `${key}#1`,
  cargoItemId: key,
  label: key,
  l,
  w,
  h,
  weightKg: 10,
  unloadOrder: 1,
  loadOrder: 0,
  fragile: false,
  uprightOnly: false,
  stackable: true,
  ...extra,
})

function shuffled<T>(list: T[], seed = 7): T[] {
  const out = [...list]
  let s = seed
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2 ** 31
    const j = s % (i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

describe('sha256', () => {
  it('matches Web Crypto', async () => {
    for (const text of ['', 'abc', 'मानेसर गोदाम', 'x'.repeat(1000)]) {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
      const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
      expect(sha256Hex(text)).toBe(hex)
    }
  })
})

describe('buildPackItems', () => {
  it('turns the demo cargo into 104 units / 2,638 kg with stop order', () => {
    const { items, container } = demoTripInput()
    expect(items).toHaveLength(104)
    expect(items.reduce((a, i) => a + i.weightKg, 0)).toBe(2638)
    expect(container).toEqual({ lengthCm: 975, widthCm: 243, heightCm: 243, payloadKg: 15000 })
    const ac = items.find((i) => i.label === 'Split AC indoor unit 1.5T')!
    expect(ac).toMatchObject({ unloadOrder: 1, loadOrder: 0, uprightOnly: true })
    expect(items.find((i) => i.label === 'Refrigerator 260 L')).toMatchObject({ unloadOrder: 3, stackable: false })
    expect(new Set(items.map((i) => i.key)).size).toBe(104)
  })

  it('reads the pickup stop as load order', () => {
    const { items } = buildPackItems(
      [
        {
          id: 'c1',
          label: 'Auto parts',
          length_cm: 80,
          width_cm: 60,
          height_cm: 60,
          weight_kg: 45,
          quantity: 2,
          pickup_stop_id: 's2',
          drop_stop_id: 's3',
          fragile: false,
          upright_only: false,
          stackable: true,
          max_top_load_kg: 200,
        },
      ],
      [
        { id: 's0', seq: 0 },
        { id: 's2', seq: 2 },
        { id: 's3', seq: 3 },
      ],
      { internal_length_cm: 975, internal_width_cm: 243, internal_height_cm: 243, payload_kg: 15000 },
    )
    expect(items.map((i) => i.key)).toEqual(['c1#1', 'c1#2'])
    expect(items[0]).toMatchObject({ loadOrder: 2, unloadOrder: 3, maxTopLoadKg: 200 })
  })
})

describe('pack', () => {
  it('8 cubes fill a cube truck 100%', () => {
    const c: PackContainer = { lengthCm: 100, widthCm: 100, heightCm: 100, payloadKg: 1000 }
    const items = Array.from({ length: 8 }, (_, i) => cube(i + 1, 50))
    const r = pack(c, items)
    expect(r.unplaced).toEqual([])
    expect(r.metrics.volumeUsedPct).toBe(100)
    expect(r.metrics.freeVolumeM3).toBe(0)
    expect(validatePlan(c, items, r)).toEqual([])
  })

  it('demo trip: 104 placed, 0 unplaced, valid, in under 1.5 s', () => {
    const { container, items } = demoTripInput()
    const t0 = performance.now()
    const r = pack(container, items)
    const ms = performance.now() - t0
    expect(r.placements).toHaveLength(104)
    expect(r.unplaced).toEqual([])
    expect(ms).toBeLessThan(1500)
    expect(validatePlan(container, items, r)).toEqual([])
    expect(r.metrics.itemCount).toBe(104)
    expect(r.metrics.volumeUsedPct).toBeCloseTo(34.3, 0)
    expect(r.metrics.weightUsedPct).toBeCloseTo(17.6, 1)
    expect(r.metrics.remainingPayloadKg).toBe(12362)
    expect(r.metrics.usedLengthCm).toBeLessThan(975)
    expect(r.warnings.map((w) => w.code)).toEqual([])
    // LIFO: Mumbai deepest (cab side), Jaipur by the doors
    const avgX = (u: number) => {
      const ps = r.placements.filter((p) => p.unloadOrder === u)
      return ps.reduce((a, p) => a + p.x + p.l / 2, 0) / ps.length
    }
    expect(avgX(3)).toBeLessThan(avgX(2))
    expect(avgX(2)).toBeLessThan(avgX(1))
    // steps 1..104, Mumbai loaded first
    expect(r.placements.map((p) => p.step)).toEqual(Array.from({ length: 104 }, (_, i) => i + 1))
    expect(r.placements[0].unloadOrder).toBe(3)
  })

  it('is deterministic, also with the items in another order', () => {
    const { container, items } = demoTripInput()
    const a = pack(container, items)
    const b = pack(container, items)
    const c = pack(container, shuffled(items))
    expect(b).toEqual(a)
    expect(c).toEqual(a)
    expect(a.inputHash).toBe(computeInputHash(container, shuffled(items, 3)))
    expect(a.inputHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('a different support ratio or truck gives a different hash', () => {
    const { container, items } = demoTripInput()
    const h = computeInputHash(container, items)
    expect(computeInputHash(container, items, { supportRatio: 0.8 })).not.toBe(h)
    expect(computeInputHash({ ...container, payloadKg: 9000 }, items)).not.toBe(h)
  })

  it('over payload: the coil that is too heavy is not placed, with the reason', () => {
    const { container, items } = overPayloadInput()
    const r = pack(container, items)
    expect(validatePlan(container, items, r)).toEqual([])
    const coils = r.unplaced.filter((u) => u.key.startsWith('steel-coils'))
    expect(coils.length).toBeGreaterThan(0)
    expect(coils.every((u) => u.reason === 'OVER_PAYLOAD')).toBe(true)
    expect(r.metrics.remainingPayloadKg).toBeGreaterThanOrEqual(0)
    expect(r.metrics.unplacedCount).toBe(r.unplaced.length)
  })

  it('TOO_LARGE when no orientation fits', () => {
    const { container } = demoTripInput()
    const items = [box('pipe', 1000, 30, 30)]
    const r = pack(container, items)
    expect(r.unplaced).toEqual([{ key: 'pipe#1', label: 'pipe', reason: 'TOO_LARGE' }])
  })

  it('NO_SUPPORT when the only space is on top of a fragile box', () => {
    const c: PackContainer = { lengthCm: 100, widthCm: 100, heightCm: 100, payloadKg: 1000 }
    const items = [box('glass', 100, 100, 50, { fragile: true, uprightOnly: true }), box('crate', 100, 100, 40, { uprightOnly: true })]
    const r = pack(c, items)
    expect(r.placements.map((p) => p.key)).toEqual(['glass#1'])
    expect(r.unplaced).toEqual([{ key: 'crate#1', label: 'crate', reason: 'NO_SUPPORT' }])
  })

  it('ORDER_CONFLICT when the only space would block goods that leave earlier', () => {
    const c: PackContainer = { lengthCm: 100, widthCm: 50, heightCm: 50, payloadKg: 1000 }
    const jaipur: Placement = {
      key: 'jaipur#1',
      cargoItemId: 'jaipur',
      label: 'jaipur',
      x: 0,
      y: 0,
      z: 0,
      l: 50,
      w: 50,
      h: 50,
      orientation: 0,
      unloadOrder: 1,
      weightKg: 10,
      fragile: false,
      step: 1,
    }
    const mumbai = box('mumbai', 50, 50, 50, { unloadOrder: 3 })
    const r = fitAdditional(c, [jaipur], [mumbai])
    expect(r.unplaced).toEqual([{ key: 'mumbai#1', label: 'mumbai', reason: 'ORDER_CONFLICT' }])
  })

  it('heavier boxes only on boxes at least as heavy (heavyBelow)', () => {
    const c: PackContainer = { lengthCm: 50, widthCm: 50, heightCm: 100, payloadKg: 1000 }
    const light: Placement = {
      key: 'light#1',
      cargoItemId: 'light',
      label: 'light',
      x: 0,
      y: 0,
      z: 0,
      l: 50,
      w: 50,
      h: 50,
      orientation: 0,
      unloadOrder: 1,
      weightKg: 5,
      fragile: false,
      step: 1,
    }
    const lightItem = box('light', 50, 50, 50, { weightKg: 5 })
    const heavy = box('heavy', 50, 50, 50, { weightKg: 50 })
    expect(fitAdditional(c, [light], [lightItem, heavy]).unplaced[0]?.reason).toBe('NO_SUPPORT')
    expect(fitAdditional(c, [light], [lightItem, heavy], { heavyBelow: false }).unplaced).toEqual([])
  })

  it('overhang follows the support ratio', () => {
    const c: PackContainer = { lengthCm: 100, widthCm: 100, heightCm: 100, payloadKg: 1000 }
    const items = [
      box('base', 60, 100, 20, { weightKg: 100, uprightOnly: true }),
      box('board', 100, 100, 20, { weightKg: 10, uprightOnly: true, unloadOrder: 1 }),
    ]
    // board is the bigger box → placed first on the floor; put the base in first instead
    const fixedBase: Placement = { ...items[0], x: 0, y: 0, z: 0, orientation: 0, step: 1 } as Placement
    const strict = fitAdditional(c, [fixedBase], items, { supportRatio: 1 })
    expect(strict.unplaced.map((u) => u.reason)).toEqual(['NO_SUPPORT'])
    const loose = fitAdditional(c, [fixedBase], items, { supportRatio: 0.5 })
    expect(loose.unplaced).toEqual([])
    expect(loose.placements.find((p) => p.key === 'board#1')).toMatchObject({ z: 20 })
    expect(validatePlan(c, items, loose, { supportRatio: 0.5 })).toEqual([])
  })

  it('a small load is moved over the axles and to the middle, not left at the cab', () => {
    const { container } = demoTripInput()
    const items: PackItem[] = [
      ...[1, 2, 3, 4].map((n) => ({ ...box('jaipur', 40, 30, 30, { weightKg: 2, unloadOrder: 1 }), key: `jaipur#${n}` })),
      ...[1, 2].map((n) => ({ ...box('mumbai', 40, 30, 30, { weightKg: 2, unloadOrder: 2 }), key: `mumbai#${n}` })),
      box('glass', 40, 30, 30, { weightKg: 2, unloadOrder: 2, fragile: true, stackable: false }),
    ]
    const r = pack(container, items)
    expect(r.unplaced).toEqual([])
    expect(validatePlan(container, items, r)).toEqual([])
    expect(r.metrics.cogXPct).toBeGreaterThanOrEqual(35)
    expect(r.metrics.cogXPct).toBeLessThanOrEqual(45)
    expect(Math.abs(r.metrics.cogYPct - 50)).toBeLessThan(5)
    const codes = r.warnings.map((w) => w.code)
    expect(codes).not.toContain('COG_LONGITUDINAL')
    expect(codes).not.toContain('COG_LATERAL')
    expect(codes).toContain('LOAD_GAP')
    // validatePlan above also checks stop order (Jaipur never blocked by Mumbai); nothing sits on the fragile box
    const g = r.placements.find((p) => p.key === 'glass#1')!
    expect(r.placements.some((p) => p.z > g.z && Math.abs(p.z - (g.z + g.h)) < 0.5 && p.x < g.x + g.l && p.x + p.l > g.x && p.y < g.y + g.w && p.y + p.w > g.y)).toBe(false)
  })

  it('a truck already partly loaded is not moved', () => {
    const c: PackContainer = { lengthCm: 400, widthCm: 200, heightCm: 200, payloadKg: 1000 }
    const loaded: Placement = { key: 'a#1', cargoItemId: 'a', label: 'a', x: 0, y: 0, z: 0, l: 50, w: 50, h: 50, orientation: 0, unloadOrder: 2, weightKg: 10, fragile: false, step: 1 }
    const r = fitAdditional(c, [loaded], [box('b', 50, 50, 50, { unloadOrder: 1 })])
    expect(r.placements.find((p) => p.key === 'a#1')).toMatchObject({ x: 0, y: 0, z: 0 })
  })

  it('0 items → empty plan', () => {
    const { container } = demoTripInput()
    const r = pack(container, [])
    expect(r.placements).toEqual([])
    expect(r.unplaced).toEqual([])
    expect(r.warnings).toEqual([])
    expect(r.metrics).toMatchObject({ volumeUsedPct: 0, weightUsedPct: 0, usedLengthCm: 0, itemCount: 0, remainingPayloadKg: 15000 })
  })

  it('validatePlan catches broken plans', () => {
    const { container, items } = demoTripInput()
    const r = pack(container, items)
    const broken = structuredClone(r)
    broken.placements[1] = { ...broken.placements[1], x: broken.placements[0].x, y: broken.placements[0].y, z: broken.placements[0].z }
    expect(validatePlan(container, items, broken).some((e) => e.includes('overlaps'))).toBe(true)
  })

  it('random cargo always gives valid plans', () => {
    const c: PackContainer = { lengthCm: 610, widthCm: 229, heightCm: 229, payloadKg: 9000 }
    let s = 42
    const rnd = (min: number, max: number) => {
      s = (s * 1103515245 + 12345) % 2 ** 31
      return min + (s % (max - min + 1))
    }
    for (let run = 0; run < 5; run++) {
      const items: PackItem[] = Array.from({ length: 60 }, (_, i) =>
        box(`r${run}-${i}`, rnd(20, 120), rnd(20, 100), rnd(20, 100), {
          weightKg: rnd(2, 120),
          unloadOrder: rnd(1, 3),
          fragile: rnd(0, 5) === 0,
          stackable: rnd(0, 6) !== 0,
          uprightOnly: rnd(0, 2) === 0,
        }),
      )
      for (const supportRatio of [1, 0.7]) {
        const r = pack(c, items, { supportRatio })
        expect(validatePlan(c, items, r, { supportRatio })).toEqual([])
      }
    }
  })
})

describe('fitAdditional', () => {
  it('keeps loaded boxes where they are and fits the rest', () => {
    const { container, items } = demoTripInput()
    const first = pack(container, items)
    const loaded = first.placements.slice(0, 30)
    const r = fitAdditional(container, loaded, items)
    for (const p of loaded) expect(r.placements.find((q) => q.key === p.key)).toEqual({ ...p, fixed: true })
    expect(r.placements).toHaveLength(104)
    expect(r.unplaced).toEqual([])
    expect(validatePlan(container, items, r)).toEqual([])
  })

  it('a load picked up mid-trip is not blocked by boxes already unloaded before the pickup', () => {
    const { container, items } = demoTripInput()
    const first = pack(container, items)
    // picked up after stop 2 (Ahmedabad), dropped at stop 3 (Mumbai): Jaipur + Ahmedabad boxes are gone by then
    const extra = Array.from({ length: 18 }, (_, i) =>
      box('vadodara-parts', 80, 60, 60, { key: `vadodara-parts#${i + 1}`, weightKg: 45, unloadOrder: 3, loadOrder: 2.5 }),
    )
    const r = fitAdditional(container, first.placements, [...items, ...extra])
    expect(r.unplaced).toEqual([])
    expect(validatePlan(container, [...items, ...extra], r)).toEqual([])
    // picked up earlier (right after the origin): the plan must stay valid as well
    const later = extra.map((x) => ({ ...x, key: x.key.replace('parts', 'late'), cargoItemId: 'vadodara-late', loadOrder: 0.5, unloadOrder: 3 }))
    const r2 = fitAdditional(container, first.placements, [...items, ...later])
    expect(validatePlan(container, [...items, ...later], r2)).toEqual([])
  })

  it('adds an extra load around the fixed plan', () => {
    const { container, items } = demoTripInput()
    const first = pack(container, items)
    const extra = Array.from({ length: 18 }, (_, i) =>
      box('auto-parts', 80, 60, 60, { key: `auto-parts#${i + 1}`, weightKg: 45, unloadOrder: 3, loadOrder: 0 }),
    )
    const r = fitAdditional(container, first.placements, [...items, ...extra])
    expect(r.placements).toHaveLength(104 + 18 - r.unplaced.length)
    expect(r.placements.filter((p) => p.fixed)).toHaveLength(104)
    expect(validatePlan(container, [...items, ...extra], r)).toEqual([])
    expect(r.inputHash).not.toBe(first.inputHash)
  })
})
