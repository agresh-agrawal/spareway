import type { Placement } from '@/types/domain'
import { firstOpenStep, pollInterval, positionWords } from './lib/position'

const truck = { lengthCm: 975, widthCm: 243 }
const box = (over: Partial<Placement>): Placement => ({
  key: 'k',
  cargoItemId: 'c',
  label: 'Box',
  x: 0,
  y: 0,
  z: 0,
  l: 60,
  w: 40,
  h: 45,
  orientation: 0,
  unloadOrder: 1,
  weightKg: 10,
  fragile: false,
  step: 1,
  ...over,
})

describe('positionWords', () => {
  it('cab side · left · floor for a box at the origin', () => {
    expect(positionWords(box({}), truck)).toEqual({ along: 'cab', across: 'left', layer: 1 })
  })
  it('middle / door thirds and right side', () => {
    expect(positionWords(box({ x: 450, y: 200 }), truck)).toMatchObject({ along: 'middle', across: 'right' })
    expect(positionWords(box({ x: 900, y: 100 }), truck)).toMatchObject({ along: 'door', across: 'centre' })
  })
  it('counts layers from the floor', () => {
    const all = [box({ key: 'a' }), box({ key: 'b', z: 45 }), box({ key: 'c', z: 90 })]
    expect(positionWords(all[1], truck, all).layer).toBe(2)
    expect(positionWords(all[2], truck, all).layer).toBe(3)
  })
})

describe('loader polling', () => {
  it('5 s while visible, 10 s in low-data, paused while hidden', () => {
    expect(pollInterval(true, false)).toBe(5000)
    expect(pollInterval(true, true)).toBe(10000)
    expect(pollInterval(false, false)).toBe(false)
    expect(pollInterval(false, true)).toBe(false)
  })
})

describe('first open step', () => {
  it('starts at the first pending step, skipping done and problem steps', () => {
    expect(
      firstOpenStep([
        { step: 1, status: 'done' },
        { step: 2, status: 'issue' },
        { step: 3, status: 'pending' },
        { step: 4, status: 'pending' },
      ]),
    ).toBe(3)
  })
  it('all done → last step; nothing → step 1', () => {
    expect(firstOpenStep([{ step: 1, status: 'done' }, { step: 2, status: 'done' }])).toBe(2)
    expect(firstOpenStep([])).toBe(1)
  })
})
